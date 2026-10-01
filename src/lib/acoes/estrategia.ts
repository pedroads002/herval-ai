"use server";

/**
 * A gravação da Estratégia do Cliente.
 *
 *   salvarEstrategia   grava um bloco da ficha de um cliente em `clinicas`.
 *
 * Um bloco por envio, e não a ficha inteira: cada cartão da tela abre, edita e
 * fecha sozinho, então o que chega aqui são só as colunas daquele cartão. Quem
 * decide quais são é `estrategiaDoFormulario.ts`, que lê o campo escondido
 * `bloco` — sem isso, salvar o objetivo do atendimento apagaria os convênios.
 *
 * Esta tela não escreve em `leads` nem em `agendamentos`, e nenhuma coluna aqui
 * guarda valor, preço ou dinheiro. A Helô fala de política — se a avaliação é
 * gratuita, quando é cobrada, se ela pode entrar no assunto — e nunca de número.
 */

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/acoes/etapaDoLead";
import { lerEstrategia } from "@/lib/acoes/estrategiaDoFormulario";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

/** O que aparece no aviso verde depois de salvar. */
const NOME_DO_BLOCO = {
  objetivo: "Objetivo do atendimento",
  avaliacao: "Avaliação / consulta",
  comercial: "Condições comerciais",
  publico: "Público-alvo",
  comunicacao: "Diretrizes de comunicação",
} as const;

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(mensagem: string): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now() };
}

export async function salvarEstrategia(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  /*
    A conferência de sessão precisa estar aqui dentro, e não só no proxy: uma
    ação de servidor é um endereço POST como outro qualquer, e o proxy protege a
    *tela*. É a mesma razão de `acoes/agenda.ts`.
  */
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const dados = lerEstrategia(formData);
  if ("erro" in dados) return recusar(dados.erro);

  /*
    Conferir que o cliente existe antes de gravar.

    Um `update ... where id = X` num id que não existe não é erro no Postgres:
    ele afeta zero linhas e volta satisfeito. Sem esta leitura, quem editasse a
    ficha de um cliente apagado em outra aba veria "Objetivo do atendimento
    salvo." sem nada ter sido salvo em lugar nenhum.
  */
  const { data: cliente, error: erroDaLeitura } = await sessao.supabase
    .from("clinicas")
    .select("id, nome")
    .eq("id", dados.clienteId)
    .maybeSingle();

  if (erroDaLeitura) {
    return recusar(`Não deu para conferir o cliente: ${erroDaLeitura.message}`);
  }
  if (!cliente) {
    return recusar(
      "Esse cliente não existe mais. Atualize a tela e escolha outro.",
    );
  }

  const { error } = await sessao.supabase
    .from("clinicas")
    .update(dados.campos)
    .eq("id", dados.clienteId);

  if (error) {
    /*
      23514 é CHECK violado. A tela e a leitura do formulário já recusam tudo o
      que o banco recusaria, então chegar aqui quer dizer que as duas listas
      saíram de sincronia — o CHECK em `supabase/estrategia-do-cliente.sql` e a
      lista em `fichaDaEstrategia.ts`. A mensagem aponta para isso em vez de
      despejar o nome da constraint em inglês na cara de quem preenche a ficha.
    */
    if (error.code === "23514") {
      return recusar(
        "O sistema recusou uma das opções escolhidas. Avise quem cuida do painel: uma lista da tela saiu de sincronia com a do banco.",
      );
    }
    return recusar(`Não deu para salvar: ${error.message}`);
  }

  revalidatePath("/estrategia");

  return aceitar(`${NOME_DO_BLOCO[dados.bloco]} salvo.`);
}
