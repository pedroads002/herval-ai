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
 * A aba "Fila de Atendimento" sai quase inteira daqui:
 *
 * - **Vem:** recebidos, contatados, % de contato, agendados, o tempo de
 *   resposta (mediana, média, faixas), a cauda, o alerta de cauda
 *   desproporcional, quem está aguardando contato e o alerta de lead parado.
 *   Tudo isso sai de `lead_etapa_eventos`, que guarda a entrada do lead em
 *   "Em Contato" — a definição oficial de primeiro contato.
 *
 *   Até 17/11/2026 o tempo de resposta media da chegada até a *primeira
 *   tentativa de ligação*, e com isso mediana, média, cauda e dois alertas
 *   ficavam permanentemente em "não medido": não existe registro de ligação no
 *   banco. `mensagens` guarda conversa, não telefone, e não tem canal, número
 *   de tentativa nem desfecho.
 * - **Não vem:** o alerta de recuperação vencida, que conta tentativa por
 *   tentativa de ligação. Na tela ele aparece como não verificado, nunca como
 *   em ordem — número de ligação saído de tabela que não registra ligação
 *   seria invenção com cara de medição.
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
import type { LinhaDeEventoDeEtapaDoBanco } from "@/lib/relatorios/historicoDoBanco";
import { lerQuemRespondeu } from "@/lib/dados/respostas";

export type DadosDosRelatorios = {
  leads: LinhaDeLeadDoBanco[];
  agendamentos: LinhaDeAgendamentoDoBanco[];
  /** As mudanças de etapa, de onde sai a espera pelo primeiro contato. */
  eventos: LinhaDeEventoDeEtapaDoBanco[];
  /**
   * Ids dos leads que responderam à clínica. Lista, e não `Set`, porque atravessa
   * do servidor para a tela. Ver `lib/dados/respostas.ts`.
   */
  responderam: number[];
  /** Qual cliente é dono de cada unidade, como pares para cruzar o mar de ids. */
  clinicaPorUnidade: [number, number | null][];
  clinicas: Clinica[];
  falha: string | null;
  aviso: string | null;
};

/** Ver o mesmo raciocínio em `dados/agenda.ts`. */
const TETO_DE_LINHAS = 1000;

/**
 * O tamanho de cada página das mudanças de etapa. É o máximo que o Supabase
 * devolve por pedido, então pedir mais não traria mais.
 */
const PAGINA_DE_EVENTOS = 1000;

/**
 * Até onde a leitura em páginas vai. Existe só para uma tabela que cresça sem
 * controle não travar a tela; se for atingido, o aviso de corte continua
 * aparecendo, como antes.
 */
const TETO_DE_EVENTOS = 50_000;

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/**
 * Todas as mudanças de etapa, das mais recentes para as mais antigas.
 *
 * Mesmo formato de resposta (`data` / `error`) das outras leituras, para o
 * resto da função não precisar saber que esta veio em partes. O desempate por
 * `id` mantém a paginação estável quando duas linhas têm o mesmo `criado_em`.
 */
async function lerEventosEmPaginas(supabase: Supabase) {
  const linhas: LinhaDeEventoDeEtapaDoBanco[] = [];

  for (let inicio = 0; inicio < TETO_DE_EVENTOS; inicio += PAGINA_DE_EVENTOS) {
    const { data, error } = await supabase
      .from("lead_etapa_eventos")
      .select(CAMPOS_DO_EVENTO)
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .range(inicio, inicio + PAGINA_DE_EVENTOS - 1);

    if (error) return { data: null, error };

    const pagina = (data ?? []) as LinhaDeEventoDeEtapaDoBanco[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA_DE_EVENTOS) break;
  }

  return { data: linhas, error: null };
}

const SEM_DADOS: DadosDosRelatorios = {
  leads: [],
  agendamentos: [],
  eventos: [],
  responderam: [],
  clinicaPorUnidade: [],
  clinicas: [],
  falha: null,
  aviso: null,
};

// `nome` entra para a lista de quem está aguardando contato e para o alerta de
// lead parado: os dois nomeiam o lead, e sem isso diriam só "Lead 30".
const CAMPOS_DO_LEAD =
  "id, nome, clinica_id, etapa, origem, criado_em, motivo_perda";

const CAMPOS_DO_EVENTO =
  "id, lead_id, de_etapa, para_etapa, autor_nome, criado_em";

const CAMPOS_DO_AGENDAMENTO =
  "id, lead_id, unidade_id, profissional_id, especialidade_id, data_consulta, hora_consulta, status, confirmada, fechado_por, canal_fechamento, observacao, criado_em";

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
    respostaDosEventos,
    respostaDasUnidades,
    respostaDasClinicas,
    respostaDosOrfaos,
    quemRespondeu,
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
    // As mudanças de etapa. Sem corte por data pelo mesmo motivo dos outros: a
    // espera de um lead se mede da chegada dele, que pode ser de antes do
    // período escolhido.
    //
    // Lidas em páginas, e não com o teto de mil linhas das outras leituras.
    // Esta tabela cresce muito mais rápido que `leads` — cada passo do
    // follow-up grava uma linha — e em 24/11/2026 já tinha 1.354. Com o teto,
    // tudo antes de 15/11 ficava de fora, e 159 leads contatados apareciam como
    // "aguardando contato", distorcendo % de contato e tempo de resposta.
    lerEventosEmPaginas(supabase),
    // `agendamentos` guarda a unidade, não a clínica. O relatório é por
    // cliente, então o caminho passa por aqui — igual à Visão Geral.
    supabase
      .from("unidades")
      .select("id, clinica_id")
      .order("id", { ascending: true })
      .limit(TETO_DE_LINHAS),
    // Todos os clientes, inclusive os pausados: a tela já mostra "(pausada)"
    // no filtro e na tabela, e esconder cliente pausado mudaria o relatório.
    supabase
      .from("clinicas")
      .select("id, nome, ativa")
      .order("nome", { ascending: true })
      .limit(TETO_DE_LINHAS),
    // Quantos leads estão sem cliente, só para o aviso. A tela já os deixava de
    // fora das contas — ela confere cliente por cliente e não acha dono para
    // eles —, mas os deixava de fora em silêncio: ninguém tinha como saber que
    // existiam. Contagem no banco, sem trazer linha (`head`), igual à Visão
    // Geral, para as duas telas dizerem o mesmo número.
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("clinica_id", null),
    lerQuemRespondeu(supabase),
  ]);

  const erro =
    respostaDosLeads.error ??
    respostaDosAgendamentos.error ??
    respostaDosEventos.error ??
    respostaDasUnidades.error ??
    respostaDasClinicas.error ??
    respostaDosOrfaos.error;

  if (erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler os relatórios: ${erro.message}`,
    };
  }

  if (quemRespondeu.erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler os relatórios: ${quemRespondeu.erro}`,
    };
  }

  const leads = (respostaDosLeads.data ?? []) as LinhaDeLeadDoBanco[];
  const agendamentos = (respostaDosAgendamentos.data ??
    []) as LinhaDeAgendamentoDoBanco[];

  const eventos = (respostaDosEventos.data ??
    []) as LinhaDeEventoDeEtapaDoBanco[];

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
    eventos,
    responderam: [...quemRespondeu.ids],
    clinicaPorUnidade: unidades.map((u) => [u.id, u.clinica_id]),
    clinicas,
    falha: null,
    aviso: montarAviso(
      leads.length,
      agendamentos.length,
      eventos.length,
      respostaDosOrfaos.count ?? 0,
      quemRespondeu.cortado,
    ),
  };
}

function montarAviso(
  leads: number,
  agendamentos: number,
  eventos: number,
  semCliente: number,
  mensagensCortadas: boolean,
) {
  const avisos: string[] = [];

  if (mensagensCortadas) {
    avisos.push(
      "A leitura das conversas parou no teto de linhas: o número de quem respondeu pode estar menor do que é.",
    );
  }

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

  if (eventos >= TETO_DE_EVENTOS) {
    avisos.push(
      `A Fila de Atendimento está lendo no máximo ${TETO_DE_EVENTOS.toLocaleString("pt-BR")} mudanças de etapa, as mais recentes. Lead cuja entrada em "Em Contato" ficou fora desse corte aparece como ainda não contatado.`,
    );
  }

  // O mesmo texto da Visão Geral, palavra por palavra: é o mesmo defeito, e
  // duas redações diferentes para ele fariam parecer que são dois problemas.
  if (semCliente > 0) {
    avisos.push(
      semCliente === 1
        ? 'Existe 1 lead gravado sem cliente. Ele fica fora de todas as contas desta tela, porque não há a qual operação somá-lo — e continua no banco, esperando conserto no Funil, no filtro "Sem cliente".'
        : `Existem ${semCliente} leads gravados sem cliente. Eles ficam fora de todas as contas desta tela, porque não há a qual operação somá-los — e continuam no banco, esperando conserto no Funil, no filtro "Sem cliente".`,
    );
  }

  return avisos.length > 0 ? avisos.join(" ") : null;
}
