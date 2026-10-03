/**
 * A via de leitura dos Relatórios.
 *
 * Até aqui a tela lia `useLeads()` e `clinicasIniciais` — memória do navegador
 * semeada por arquivos vazios desde a PR #34. O relatório mostrava tabela sem
 * nenhuma linha para todo mundo, em produção, enquanto os leads e as consultas
 * estavam no banco.
 *
 * As três leituras são as mesmas que a Visão Geral e o Funil já fazem, nas
 * mesmas tabelas e com os mesmos campos: nenhum segundo jeito de buscar lead,
 * consulta ou cliente.
 *
 * O que NÃO vem daqui: a aba "Fila de Atendimento". Ela se sustenta em registro
 * de ligação (canal, tentativa, desfecho, minutos até a primeira tentativa), e
 * não existe tabela de ligações no banco. Enquanto não existir, aquela aba
 * continua na fonte em memória — número de tempo de resposta saído de tabela
 * que não existe seria invenção com cara de medição.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { Clinica } from "@/data/clinicas";
import {
  montarClinicaDoBanco,
  type LinhaDeAgendamentoDoBanco,
  type LinhaDeClinicaDoBanco,
  type LinhaDeLeadDoBanco,
} from "@/lib/relatorios/doBanco";

export type DadosDosRelatorios = {
  leads: LinhaDeLeadDoBanco[];
  agendamentos: LinhaDeAgendamentoDoBanco[];
  /** Qual cliente é dono de cada unidade, como pares para cruzar o mar de ids. */
  clinicaPorUnidade: [number, number | null][];
  clinicas: Clinica[];
  falha: string | null;
  aviso: string | null;
};

/** Ver o mesmo raciocínio em `dados/agenda.ts`. */
const TETO_DE_LINHAS = 1000;

const SEM_DADOS: DadosDosRelatorios = {
  leads: [],
  agendamentos: [],
  clinicaPorUnidade: [],
  clinicas: [],
  falha: null,
  aviso: null,
};

const CAMPOS_DO_LEAD = "id, clinica_id, etapa, origem, criado_em, motivo_perda";

const CAMPOS_DO_AGENDAMENTO =
  "id, lead_id, unidade_id, profissional_id, especialidade_id, data_consulta, hora_consulta, status, confirmada, fechado_por, observacao, criado_em";

export async function carregarRelatorios(): Promise<DadosDosRelatorios> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  /*
    Nenhuma das leituras vem cortada por data, e isso é de propósito: quem
    escolhe o período é a tela, e três contas dependem de ver a lista inteira —
    a remarcação precisa da fila completa de consultas de cada lead, o follow
    compara a safra do lead com a data da consulta, e o show rate olha consulta
    marcada para o futuro. Um corte por data aqui quebraria as três.
  */
  const [
    respostaDosLeads,
    respostaDosAgendamentos,
    respostaDasUnidades,
    respostaDasClinicas,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(CAMPOS_DO_LEAD)
      .order("criado_em", { ascending: false })
      .limit(TETO_DE_LINHAS),
    supabase
      .from("agendamentos")
      .select(CAMPOS_DO_AGENDAMENTO)
      .order("criado_em", { ascending: false })
      .limit(TETO_DE_LINHAS),
    // `agendamentos` guarda a unidade, não a clínica. O relatório é por
    // cliente, então o caminho passa por aqui — igual à Visão Geral.
    supabase.from("unidades").select("id, clinica_id").limit(TETO_DE_LINHAS),
    // Todos os clientes, inclusive os pausados: a tela já mostra "(pausada)"
    // no filtro e na tabela, e esconder cliente pausado mudaria o relatório.
    supabase
      .from("clinicas")
      .select("id, nome, ativa")
      .order("nome", { ascending: true })
      .limit(TETO_DE_LINHAS),
  ]);

  const erro =
    respostaDosLeads.error ??
    respostaDosAgendamentos.error ??
    respostaDasUnidades.error ??
    respostaDasClinicas.error;

  if (erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler os relatórios: ${erro.message}`,
    };
  }

  const leads = (respostaDosLeads.data ?? []) as LinhaDeLeadDoBanco[];
  const agendamentos = (respostaDosAgendamentos.data ??
    []) as LinhaDeAgendamentoDoBanco[];

  const unidades = (respostaDasUnidades.data ?? []) as {
    id: number;
    clinica_id: number | null;
  }[];

  const quantasUnidades = new Map<number, number>();
  for (const unidade of unidades) {
    if (unidade.clinica_id === null) continue;
    quantasUnidades.set(
      unidade.clinica_id,
      (quantasUnidades.get(unidade.clinica_id) ?? 0) + 1,
    );
  }

  const clinicas = (
    (respostaDasClinicas.data ?? []) as LinhaDeClinicaDoBanco[]
  ).map((linha) =>
    montarClinicaDoBanco(linha, quantasUnidades.get(linha.id) ?? 0),
  );

  return {
    leads,
    agendamentos,
    clinicaPorUnidade: unidades.map((u) => [u.id, u.clinica_id]),
    clinicas,
    falha: null,
    aviso: montarAviso(leads.length, agendamentos.length),
  };
}

function montarAviso(leads: number, agendamentos: number) {
  const avisos: string[] = [];

  if (leads >= TETO_DE_LINHAS) {
    avisos.push(
      `O relatório está contando no máximo ${TETO_DE_LINHAS} leads, os mais recentes. Nada foi perdido no banco, mas estes números não cobrem a base inteira.`,
    );
  }

  if (agendamentos >= TETO_DE_LINHAS) {
    avisos.push(
      `O relatório está contando no máximo ${TETO_DE_LINHAS} consultas, as marcadas mais recentemente. Nada foi perdido no banco, mas estes números não cobrem a base inteira.`,
    );
  }

  return avisos.length > 0 ? avisos.join(" ") : null;
}
