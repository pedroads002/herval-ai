"use server";

/**
 * As duas gravações da seção Profissionais — **a primeira vez que o painel
 * escreve num cadastro.** Até aqui ele só escrevia conversa: nota e mensagem.
 *
 * Roda no servidor. O navegador manda o formulário, nunca o comando.
 *
 * Por que a conferência de sessão está aqui dentro, e não só no proxy: uma
 * ação de servidor é um endereço POST como outro qualquer. O proxy protege a
 * *tela*; quem chamasse a ação direto não passaria por tela nenhuma. Sem esta
 * conferência, a última tranca seria a RLS — que sozinha resolveria, mas
 * deixar a porta anterior aberta de propósito é confiar numa tranca só.
 */

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { tiposDeProfissional } from "@/lib/dados/tiposDeProfissional";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

const LIMITE_NOME = 120;
const LIMITE_REGISTRO = 60;

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(mensagem: string): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now() };
}

type ClienteDoServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Sessão válida ou o motivo da recusa. Nunca as duas coisas. */
async function exigirSessao(): Promise<
  { erro: string } | { supabase: ClienteDoServidor }
> {
  if (!supabaseConfigurado()) {
    return { erro: "O Supabase não está configurado neste ambiente." };
  }

  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { erro: "Sua sessão expirou. Entre de novo para cadastrar." };
  }

  return { supabase };
}

/** Lê um campo de texto do formulário já aparado. */
function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

/**
 * Lê uma lista de caixas marcadas como números.
 *
 * Valor que não é número inteiro positivo é descartado em silêncio de
 * propósito: essas caixas são geradas pela própria tela, então qualquer outra
 * coisa chegando aqui é pedido adulterado, não engano de quem cadastra. O que
 * sobra ainda passa pela chave estrangeira do banco.
 */
function numeros(formData: FormData, campo: string) {
  const vistos = new Set<number>();
  for (const bruto of formData.getAll(campo)) {
    const n = Number(bruto);
    if (Number.isInteger(n) && n > 0) vistos.add(n);
  }
  return [...vistos];
}

/**
 * Cadastra um cliente novo — uma linha em `clinicas`, com o nome e nada mais.
 *
 * A primeira unidade não é criada aqui: existe um gatilho no banco que a cria
 * junto, com o mesmo nome do cliente. Duplicar isso no painel daria duas
 * unidades para quem cadastrasse por aqui e uma para quem cadastrasse por
 * fora.
 *
 * `numero_unidades` é preenchido com 1 porque é o que o gatilho acabou de
 * fazer. A coluna é um número digitado à mão, que já convive com a contagem
 * real das unidades — deixá-la em zero com uma unidade existindo seria criar a
 * contradição no momento do cadastro.
 */
export async function cadastrarCliente(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const nome = texto(formData, "nome");

  if (nome === "") return recusar("O nome do cliente é obrigatório.");
  if (nome.length > LIMITE_NOME) {
    return recusar(`O nome passou de ${LIMITE_NOME} caracteres.`);
  }

  const { error } = await sessao.supabase
    .from("clinicas")
    .insert({ nome, numero_unidades: 1 });

  if (error) return recusar(`Não deu para cadastrar o cliente: ${error.message}`);

  revalidatePath("/profissionais");
  return aceitar(`Cliente "${nome}" cadastrado, já com a primeira unidade.`);
}

/**
 * Cadastra um profissional e as ligações dele.
 *
 * São três gravações — a pessoa, as especialidades e os lugares — e o Supabase
 * não as junta numa transação. Se uma ligação falhar, o profissional é apagado
 * (o `on delete cascade` leva junto o que já tinha entrado) e nada fica pela
 * metade. Sem isso, um erro no meio deixaria alguém cadastrado sem lugar
 * nenhum, com cara de cadastro concluído.
 */
export async function cadastrarProfissional(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const nome = texto(formData, "nome");
  const tipo = texto(formData, "tipo");
  const registro = texto(formData, "registro");
  const especialidadeIds = numeros(formData, "especialidades");
  const unidadeIds = numeros(formData, "unidades");

  if (nome === "") return recusar("O nome do profissional é obrigatório.");
  if (nome.length > LIMITE_NOME) {
    return recusar(`O nome passou de ${LIMITE_NOME} caracteres.`);
  }
  // A mesma lista que trava a coluna no banco. Conferir aqui é o que produz
  // uma frase em português em vez do erro cru do CHECK.
  if (!(tiposDeProfissional as readonly string[]).includes(tipo)) {
    return recusar("Escolha o tipo do profissional.");
  }
  if (registro.length > LIMITE_REGISTRO) {
    return recusar(`O registro passou de ${LIMITE_REGISTRO} caracteres.`);
  }
  if (unidadeIds.length === 0) {
    return recusar("Marque pelo menos um lugar onde a pessoa atende.");
  }

  const { data: criado, error: erroDoProfissional } = await sessao.supabase
    .from("profissionais")
    .insert({ nome, tipo, registro: registro === "" ? null : registro })
    .select("id")
    .single();

  if (erroDoProfissional || !criado) {
    return recusar(
      `Não deu para cadastrar o profissional: ${erroDoProfissional?.message ?? "o banco não devolveu o cadastro."}`,
    );
  }

  const erroDasLigacoes = await ligar(sessao.supabase, criado.id, {
    especialidadeIds,
    unidadeIds,
  });

  if (erroDasLigacoes) {
    const { error: erroAoDesfazer } = await sessao.supabase
      .from("profissionais")
      .delete()
      .eq("id", criado.id);

    if (erroAoDesfazer) {
      // Caso raro e o único que deixa sujeira. Dizer o número torna o conserto
      // possível, em vez de virar um cadastro fantasma sem explicação.
      return recusar(
        `O cadastro falhou (${erroDasLigacoes}) e não deu para desfazer: o profissional nº ${criado.id} ficou gravado sem as ligações.`,
      );
    }

    return recusar(`Não deu para cadastrar: ${erroDasLigacoes}`);
  }

  revalidatePath("/profissionais");
  return aceitar(`${nome} cadastrado.`);
}

/** Grava as duas listas de ligação. Devolve o motivo da primeira falha, ou nada. */
async function ligar(
  supabase: ClienteDoServidor,
  profissionalId: number,
  ligacoes: { especialidadeIds: number[]; unidadeIds: number[] },
) {
  if (ligacoes.especialidadeIds.length > 0) {
    const { error } = await supabase.from("profissional_especialidades").insert(
      ligacoes.especialidadeIds.map((especialidade_id) => ({
        profissional_id: profissionalId,
        especialidade_id,
      })),
    );
    if (error) return `não deu para gravar as especialidades (${error.message})`;
  }

  const { error } = await supabase.from("profissional_unidades").insert(
    ligacoes.unidadeIds.map((unidade_id) => ({
      profissional_id: profissionalId,
      unidade_id,
    })),
  );
  if (error) return `não deu para gravar os lugares (${error.message})`;

  return null;
}
