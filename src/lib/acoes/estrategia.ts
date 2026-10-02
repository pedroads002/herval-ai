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
 * Esta tela não escreve em `leads` nem em `agendamentos`. A única coisa que ela
 * grava fora de `clinicas` é a faixa de valor médio de cada procedimento, em
 * `clinica_especialidades` — e faixa aproximada é a única forma de valor que
 * existe no sistema. Preço fechado não é guardado em lugar nenhum: o número que
 * a paciente pode tomar como combinado só é dito na consulta de avaliação.
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

/**
 * O cliente do Supabase já autenticado, sem precisar importar o tipo de dentro
 * de `etapaDoLead.ts`: é o mesmo que `exigirSessao` entrega no ramo que deu
 * certo. Tirado de lá de propósito — se aquela função trocar de cliente um dia,
 * esta assinatura acompanha sozinha.
 */
type ClienteAutenticado = Extract<
  Awaited<ReturnType<typeof exigirSessao>>,
  { supabase: unknown }
>["supabase"];

/**
 * As faixas de valor médio deste cliente, em `clinica_especialidades`.
 *
 * Grava o que veio e apaga o que não veio: um procedimento cuja faixa foi
 * esvaziada na tela tem de sair da tabela, senão continuaria valendo no prompt
 * da Helô depois de alguém ter apagado o campo e visto "salvo".
 *
 * Nesta ordem — primeiro gravar, depois apagar o resto — para não existir um
 * instante em que a clínica está sem faixa nenhuma. As duas operações não são
 * uma transação só; se a segunda falhar, sobra faixa a mais, que é o lado
 * errado menos perigoso: valor velho visível é melhor que valor sumido sem
 * ninguém saber, e a mensagem de erro manda conferir.
 *
 * Devolve a frase da recusa, ou nulo quando deu tudo certo.
 */
async function gravarFaixasDeValor(
  supabase: ClienteAutenticado,
  clienteId: number,
  faixas: { especialidade_id: number }[],
): Promise<string | null> {
  if (faixas.length > 0) {
    const { error } = await supabase.from("clinica_especialidades").upsert(
      faixas.map((faixa) => ({ ...faixa, clinica_id: clienteId })),
      { onConflict: "clinica_id,especialidade_id" },
    );

    if (error) {
      // 23514 é CHECK violado: meia faixa ou faixa invertida. A leitura do
      // formulário já recusa as duas, então chegar aqui é a tela ter saído de
      // sincronia com o banco — e não erro de quem preencheu.
      if (error.code === "23514") {
        return "O banco recusou uma faixa de valor médio. Avise quem cuida do painel: a conferência da tela saiu de sincronia com a do banco.";
      }
      return `Os outros campos foram salvos, mas não deu para salvar as faixas de valor médio: ${error.message}`;
    }
  }

  const aManter = faixas.map((faixa) => faixa.especialidade_id);

  const apagar = supabase
    .from("clinica_especialidades")
    .delete()
    .eq("clinica_id", clienteId);

  const { error: erroDoApagar } =
    aManter.length === 0
      ? await apagar
      : await apagar.not("especialidade_id", "in", `(${aManter.join(",")})`);

  if (erroDoApagar) {
    return `As faixas foram salvas, mas não deu para apagar as que você esvaziou: ${erroDoApagar.message}. Confira o bloco Comercial antes de confiar nelas.`;
  }

  return null;
}

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

  if (dados.faixas !== null) {
    const erroDasFaixas = await gravarFaixasDeValor(
      sessao.supabase,
      dados.clienteId,
      dados.faixas,
    );
    if (erroDasFaixas !== null) {
      revalidatePath("/estrategia");
      return recusar(erroDasFaixas);
    }
  }

  revalidatePath("/estrategia");

  return aceitar(`${NOME_DO_BLOCO[dados.bloco]} salvo.`);
}
