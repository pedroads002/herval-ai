/**
 * A via de leitura do catálogo de procedimentos.
 *
 * No banco a tabela se chama `especialidades` e continua com esse nome: as
 * leituras do Atendimento e do cadastro de profissionais apontam para lá, e
 * renomear tabela para acompanhar rótulo de tela é trocar um risco real por um
 * ganho nenhum. Na tela a palavra é "procedimento", que é como a agência fala.
 *
 * O catálogo é da agência, e não de um cliente: os 23 procedimentos são a lista
 * de onde cada profissional marca o que realiza. O que uma clínica atende é
 * outra coisa, e sai da equipe dela — ver `especialidadesDaClinica` em
 * `atendimento.ts`.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

export type ProcedimentoDoCatalogo = {
  id: number;
  nome: string;
  /** Duração da consulta de avaliação, em minutos. */
  duracaoMinutos: number;
  ativa: boolean;
  /**
   * Quem realiza este procedimento hoje.
   *
   * Só gente ativa. Quem está inativo não pode receber lead nenhum, então
   * contá-lo aqui faria a tela dizer que três pessoas atendem algo que na
   * prática ninguém atende — e é justamente essa a pergunta que esta lista
   * responde antes de alguém desativar um procedimento.
   */
  quemAtende: { id: number; nome: string }[];
};

export type DadosDoCatalogo = {
  procedimentos: ProcedimentoDoCatalogo[];
  /**
   * Por que a tela está vazia, quando estiver. Separa "catálogo vazio" de "não
   * consegui ler o banco" — sem isso as duas viram a mesma tela em branco, e a
   * segunda é defeito.
   */
  falha: string | null;
};

type LinhaProcedimento = {
  id: number;
  nome: string | null;
  duracao_minutos: number;
  ativa: boolean;
};

type LinhaQuemAtende = {
  especialidade_id: number;
  profissionais: {
    id: number;
    nome: string | null;
    nome_exibicao: string | null;
  } | null;
};

export async function carregarProcedimentos(): Promise<DadosDoCatalogo> {
  if (!supabaseConfigurado()) {
    return {
      procedimentos: [],
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  const [respostaProcedimentos, respostaQuemAtende] = await Promise.all([
    supabase
      .from("especialidades")
      .select("id, nome, duracao_minutos, ativa")
      .order("nome", { ascending: true }),
    supabase
      .from("profissional_especialidades")
      .select("especialidade_id, profissionais!inner(id, nome, nome_exibicao)")
      .eq("profissionais.ativo", true),
  ]);

  // As duas leituras são obrigatórias. Deixar a segunda falhar em silêncio
  // mostraria "ninguém atende" para todos os procedimentos — que é exatamente o
  // que se vê quando a agência ainda não cadastrou equipe, e uma das duas
  // situações é defeito.
  const erro = respostaProcedimentos.error ?? respostaQuemAtende.error;

  if (erro) {
    return {
      procedimentos: [],
      falha: `Não deu para ler o catálogo: ${erro.message}`,
    };
  }

  const equipePorProcedimento = new Map<
    number,
    { id: number; nome: string }[]
  >();

  for (const linha of (respostaQuemAtende.data ??
    []) as unknown as LinhaQuemAtende[]) {
    const pessoa = linha.profissionais;
    if (pessoa === null) continue;

    const nome =
      (pessoa.nome_exibicao ?? "").trim() || (pessoa.nome ?? "").trim();
    const lista = equipePorProcedimento.get(linha.especialidade_id);
    const item = { id: pessoa.id, nome: nome || "Sem nome" };

    if (lista) lista.push(item);
    else equipePorProcedimento.set(linha.especialidade_id, [item]);
  }

  const procedimentos = (
    (respostaProcedimentos.data ?? []) as LinhaProcedimento[]
  ).map((linha) => ({
    id: linha.id,
    nome: (linha.nome ?? "").trim() || "Procedimento sem nome",
    duracaoMinutos: linha.duracao_minutos,
    ativa: linha.ativa,
    quemAtende: (equipePorProcedimento.get(linha.id) ?? []).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    ),
  }));

  return { procedimentos, falha: null };
}
