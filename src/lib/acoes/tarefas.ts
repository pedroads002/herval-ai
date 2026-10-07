"use server";

/**
 * As gravações da Fila de Tarefas: a decisão (Aprovar, Rejeitar, Avisar CRC,
 * Marcar como feita) e a criação de tarefa à mão.
 *
 * Até aqui clicar nesses botões mexia só na memória do navegador —
 * `definirStatus` em `ProvedorLeads.tsx` trocava o estado e recarregar a página
 * desfazia. Para uma fila de trabalho isso é pior que não ter botão: o CRC
 * marca "avisado", sai da tela, e no dia seguinte a tarefa está pendente de
 * novo sem ninguém ter desfeito nada.
 *
 * `decidido_em` vai junto com o status porque o banco não aceita os dois
 * separados: o CHECK `tarefas_decisao_coerente` exige data nula enquanto
 * Pendente e data preenchida em qualquer outra decisão. É esse campo que vai
 * permitir medir tempo de resposta do CRC depois.
 *
 * Recebe argumentos soltos, e não `FormData`, porque quem chama é um botão da
 * tabela e não um formulário — o mesmo caminho de `acoes/funil.ts`.
 */

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/acoes/etapaDoLead";
import {
  conferirDecisao,
  conferirNovaTarefa,
  montarTarefa,
  type LinhaDeTarefa,
  type NovaTarefa,
} from "@/lib/dados/linhaDeTarefa";
import type { LinhaDeLead } from "@/lib/dados/linhaDoFunil";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

export async function decidirTarefa(
  tarefaId: number,
  status: string,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const decisao = conferirDecisao(tarefaId, status);
  if ("erro" in decisao) return recusar(decisao.erro);

  const { error } = await sessao.supabase
    .from("tarefas")
    .update({
      status: decisao.status,
      decidido_em:
        decisao.status === "Pendente" ? null : new Date().toISOString(),
    })
    .eq("id", tarefaId);

  if (error) {
    return recusar(`A decisão não foi gravada: ${error.message}`);
  }

  // A fila é a tela inicial do painel.
  revalidatePath("/");

  return {
    ok: true,
    mensagem:
      decisao.status === "Pendente"
        ? "Tarefa devolvida para pendente."
        : `Tarefa marcada como "${decisao.status}".`,
    envio: Date.now(),
  };
}

const CAMPOS_DA_TAREFA =
  "id, lead_id, tipo, regra, acao_sugerida, status, prazo_em_minutos, criado_em, decidido_em, prazo_em, descricao, atribuido_a, criado_por";

const CAMPOS_DO_LEAD =
  "id, nome, telefone, etapa, origem, criado_em, motivo_perda, clinica_id";

/**
 * Cria uma tarefa à mão.
 *
 * Quem assina é o servidor, pela sessão: `criado_por` não vem da tela. Nome de
 * autor que o navegador escolhe não é assinatura — é campo preenchível.
 *
 * `tipo` também não vem da tela, e isso é o que impede o painel de falsificar
 * uma sinalização do cérebro da Helô: aqui ele é sempre `'manual'`, e a
 * política de insert no banco só aceita esse valor.
 */
export async function criarTarefa(
  entrada: NovaTarefa,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const conferida = conferirNovaTarefa(entrada, new Date());
  if ("erro" in conferida) return recusar(conferida.erro);

  const { data, error } = await sessao.supabase
    .from("tarefas")
    .insert({ ...conferida.linha, criado_por: sessao.usuarioNome })
    .select(CAMPOS_DA_TAREFA)
    .single();

  if (error) {
    return recusar(`A tarefa não foi criada: ${error.message}`);
  }

  // A fila é a tela inicial do painel.
  revalidatePath("/");

  const criada: ResultadoDoCadastro = {
    ok: true,
    mensagem: "Tarefa criada e já na fila.",
    envio: Date.now(),
  };

  const linha = data as LinhaDeTarefa;

  // A tarefa volta montada para a tela mostrar na hora. Se esta releitura
  // falhar, a tarefa continua criada — o que se perde é só vê-la antes de
  // recarregar a página, e dizer que não foi criada seria pior.
  const { data: linhaDoLead } = await sessao.supabase
    .from("leads")
    .select(CAMPOS_DO_LEAD)
    .eq("id", linha.lead_id)
    .maybeSingle();

  if (!linhaDoLead) return criada;

  const lead = linhaDoLead as LinhaDeLead;

  const clientes = new Map<number, string>();
  if (lead.clinica_id !== null) {
    const { data: clinica } = await sessao.supabase
      .from("clinicas")
      .select("nome")
      .eq("id", lead.clinica_id)
      .maybeSingle();

    const nome = ((clinica?.nome as string | undefined) ?? "").trim();
    if (nome !== "") clientes.set(lead.clinica_id, nome);
  }

  const tarefa = montarTarefa(linha, {
    agora: new Date(),
    leads: new Map([[lead.id, lead]]),
    clientes,
  });

  return tarefa === null ? criada : { ...criada, tarefa };
}
