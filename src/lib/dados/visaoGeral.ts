/**
 * A via de leitura da Visão Geral.
 *
 * Até aqui esta tela não encostava no banco: ela consumia `useLeads()`, que é
 * memória do navegador semeada pelos arquivos de `src/data/`, e esses arquivos
 * estão vazios de propósito. O resultado em produção era zero em tudo — e pior
 * que zero: as funções de `relatorios.ts` recebem a lista de clínicas por
 * omissão do mesmo lugar, então o recorte por clínica iterava sobre uma lista
 * vazia e não havia nem como a tela ter o que mostrar.
 *
 * Por que um módulo separado, no lugar de trocar a fonte em `src/data/`: pelo
 * mesmo motivo de `dados/funil.ts`. Aqueles arquivos alimentam também
 * Relatórios e Fila de Tarefas, e o banco não tem o que aquelas telas pedem
 * (score, prazo, regra disparada, ligação). O recorte é explícito: só a Visão
 * Geral lê daqui, e o que ela mostra existe de verdade.
 *
 * As regras de negócio são as mesmas de `relatorios.ts` — remarcação,
 * no-show, degraus do funil, limiares de alerta. Estão reescritas aqui, e não
 * importadas, porque lá elas operam sobre objetos em memória com campos que o
 * banco não tem. O arquivo original não foi tocado.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import {
  ETAPA_GANHA,
  ETAPA_PERDIDA,
  etapasFunil,
  motivosDePerda,
  motivosQueDesqualificam,
  type MotivoPerda,
} from "@/data/leads";
import { metasPadrao } from "@/data/metas";
import {
  diaDeHoje,
  intervaloAnterior,
  primeiroInstante,
  ultimoInstante,
  type IntervaloDeDatas,
  type PeriodoEscolhido,
} from "@/lib/visaoGeral/periodo";

/** Ver o mesmo raciocínio em `dados/funil.ts`. */
const TETO_DE_LINHAS = 1000;

/**
 * A primeira etapa que conta como lead qualificado. É o mesmo corte de
 * `ehQualificado` em `src/data/leads.ts`, refeito aqui porque lá a constante não
 * é exportada e a função pede um `Lead` inteiro, que o banco não devolve.
 */
const PRIMEIRA_ETAPA_QUALIFICADA = etapasFunil.indexOf("Outros Contatos");

const STATUS_CANCELADA = "Cancelada";
const STATUS_FALTOU = "Faltou";
const STATUS_COMPARECEU = "Compareceu";
const STATUS_AGENDADA = "Agendada";

type LinhaDeLead = {
  id: number;
  etapa: string;
  criado_em: string;
};

type LinhaDeAgendamento = {
  id: number;
  lead_id: number;
  unidade_id: number;
  data_consulta: string;
  status: string;
  fechado_por: string;
  confirmada: boolean;
  criado_em: string;
};

export type ClinicaDaLista = { id: number; nome: string };

export type DegrauDaConversao = { etapa: string; quantidade: number };

export type MotivoContado = { motivo: MotivoPerda; quantidade: number };

export type Severidade = "critico" | "atencao";

export type AlertaDaVisao = {
  id: string;
  severidade: Severidade;
  problema: string;
  acao: string;
  /** Link opcional para a tela onde a coisa se resolve. */
  destino?: { texto: string; href: string };
};

/** Os números de um intervalo. Vale para o período atual e para o anterior. */
export type ResumoDoPeriodo = {
  leads: number;
  /** Agendamentos pelo ato de agendar: `criado_em` dentro do período. */
  agendamentos: number;
  /** Desses agendamentos, os que já aconteceram e tiveram presença. */
  comparecimentos: number;
  vendas: number;
  faltas: number;
  cancelamentos: number;
  /** Agendamentos do período cuja consulta já passou. */
  consultasAteAData: number;
  remarcacoes: number;
  fechadosPelaIa: number;
  fechadosPeloCrc: number;
  qualificados: number;
  leadsComAgendamento: number;
  /** Percentuais; `null` quando não há base para dividir. */
  taxaNoShow: number | null;
  taxaReagendamento: number | null;
  percentualIa: number | null;
  taxaCancelamento: number | null;
  showRate: number | null;
  taxaAgendamento: number | null;
};

export type DadosDaVisaoGeral = {
  atual: ResumoDoPeriodo;
  anterior: ResumoDoPeriodo;
  conversao: DegrauDaConversao[];
  motivos: MotivoContado[];
  totalPerdidos: number;
  alertas: AlertaDaVisao[];
  clinicas: ClinicaDaLista[];
  falha: string | null;
  aviso: string | null;
};

const RESUMO_VAZIO: ResumoDoPeriodo = {
  leads: 0,
  agendamentos: 0,
  comparecimentos: 0,
  vendas: 0,
  faltas: 0,
  cancelamentos: 0,
  consultasAteAData: 0,
  remarcacoes: 0,
  fechadosPelaIa: 0,
  fechadosPeloCrc: 0,
  qualificados: 0,
  leadsComAgendamento: 0,
  taxaNoShow: null,
  taxaReagendamento: null,
  percentualIa: null,
  taxaCancelamento: null,
  showRate: null,
  taxaAgendamento: null,
};

const SEM_DADOS: DadosDaVisaoGeral = {
  atual: RESUMO_VAZIO,
  anterior: RESUMO_VAZIO,
  conversao: [],
  motivos: [],
  totalPerdidos: 0,
  alertas: [],
  clinicas: [],
  falha: null,
  aviso: null,
};

/** Percentual arredondado, ou `null` quando não existe base. */
function taxa(parte: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((parte / total) * 100);
}

function ehQualificado(etapa: string, motivo: string | null): boolean {
  // Lead perdido continua qualificado, menos quando o motivo da perda diz que
  // ele nunca foi lead de verdade (clicou errado, spam, procedimento que a
  // clínica não faz).
  if (etapa === ETAPA_PERDIDA) {
    return !(
      motivo !== null && motivosQueDesqualificam.includes(motivo as MotivoPerda)
    );
  }

  return etapasFunil.indexOf(etapa as never) >= PRIMEIRA_ETAPA_QUALIFICADA;
}

/**
 * Quais agendamentos são remarcação.
 *
 * Mesma regra de `idsDeRemarcacao` em `relatorios.ts`: olhando a fila de
 * consultas de cada lead da mais antiga para a mais nova, um agendamento é
 * remarcação quando o anterior foi falta ou cancelamento. Consulta depois de um
 * comparecimento é retorno, não remarcação.
 *
 * A ordem usa `criado_em` porque é a data em que a consulta foi marcada — é ela
 * que define a sequência das tentativas, não o dia em que cada uma cairia.
 */
function idsDeRemarcacao(agendamentos: LinhaDeAgendamento[]): Set<number> {
  const porLead = new Map<number, LinhaDeAgendamento[]>();

  for (const consulta of agendamentos) {
    const fila = porLead.get(consulta.lead_id);
    if (fila) fila.push(consulta);
    else porLead.set(consulta.lead_id, [consulta]);
  }

  const remarcacoes = new Set<number>();

  for (const fila of porLead.values()) {
    const emOrdem = [...fila].sort(
      (a, b) => a.criado_em.localeCompare(b.criado_em) || a.id - b.id,
    );

    for (let i = 1; i < emOrdem.length; i += 1) {
      const anterior = emOrdem[i - 1].status;
      if (anterior === STATUS_FALTOU || anterior === STATUS_CANCELADA) {
        remarcacoes.add(emOrdem[i].id);
      }
    }
  }

  return remarcacoes;
}

function dentroDoIntervalo(dia: string, { de, ate }: IntervaloDeDatas) {
  // Comparação de texto funciona porque YYYY-MM-DD ordena como data.
  return dia >= de && dia <= ate;
}

/** O dia de calendário de um `timestamptz`, no fuso de Brasília. */
function diaDoInstante(instante: string) {
  return new Date(instante).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

type Contexto = {
  leads: LinhaDeLead[];
  motivoDoLead: Map<number, string | null>;
  agendamentos: LinhaDeAgendamento[];
  remarcacoes: Set<number>;
  hoje: string;
};

function montarResumo(
  intervalo: IntervaloDeDatas,
  contexto: Contexto,
): ResumoDoPeriodo {
  const leadsDoPeriodo = contexto.leads.filter((lead) =>
    dentroDoIntervalo(diaDoInstante(lead.criado_em), intervalo),
  );
  const idsDoPeriodo = new Set(leadsDoPeriodo.map((lead) => lead.id));

  // O "ato de agendar": a consulta entra no período em que foi marcada, não no
  // dia em que ela cairia. É o que mede o trabalho do time no período.
  const producao = contexto.agendamentos.filter((consulta) =>
    dentroDoIntervalo(diaDoInstante(consulta.criado_em), intervalo),
  );

  // Consultas dessa produção que já aconteceram. Agendamento marcado para a
  // semana que vem não pode entrar na conta de falta nem de presença.
  const jaAconteceram = producao.filter(
    (consulta) => consulta.data_consulta <= contexto.hoje,
  );

  const faltas = jaAconteceram.filter(
    (consulta) => consulta.status === STATUS_FALTOU,
  ).length;
  const comparecimentos = jaAconteceram.filter(
    (consulta) => consulta.status === STATUS_COMPARECEU,
  ).length;
  const cancelamentos = producao.filter(
    (consulta) => consulta.status === STATUS_CANCELADA,
  ).length;
  const remarcacoes = producao.filter((consulta) =>
    contexto.remarcacoes.has(consulta.id),
  ).length;

  const fechadosPelaIa = producao.filter(
    (consulta) => consulta.fechado_por === "IA",
  ).length;
  const fechadosPeloCrc = producao.length - fechadosPelaIa;

  const qualificados = leadsDoPeriodo.filter((lead) =>
    ehQualificado(lead.etapa, contexto.motivoDoLead.get(lead.id) ?? null),
  ).length;

  // Quantos leads do período chegaram a ter consulta marcada — qualquer uma, em
  // qualquer data, porque o lead é acompanhado até onde chegou.
  const comAgendamento = new Set<number>();
  for (const consulta of contexto.agendamentos) {
    if (
      idsDoPeriodo.has(consulta.lead_id) &&
      consulta.status !== STATUS_CANCELADA
    ) {
      comAgendamento.add(consulta.lead_id);
    }
  }

  const vendas = leadsDoPeriodo.filter(
    (lead) => lead.etapa === ETAPA_GANHA,
  ).length;

  return {
    leads: leadsDoPeriodo.length,
    agendamentos: producao.length,
    comparecimentos,
    vendas,
    faltas,
    cancelamentos,
    consultasAteAData: jaAconteceram.length,
    remarcacoes,
    fechadosPelaIa,
    fechadosPeloCrc,
    qualificados,
    leadsComAgendamento: comAgendamento.size,
    taxaNoShow: taxa(faltas, jaAconteceram.length),
    taxaReagendamento: taxa(remarcacoes, producao.length),
    percentualIa: taxa(fechadosPelaIa, producao.length),
    taxaCancelamento: taxa(cancelamentos, producao.length),
    showRate: taxa(comparecimentos, jaAconteceram.length),
    taxaAgendamento: taxa(comAgendamento.size, qualificados),
  };
}

/** Os quatro degraus, sempre sobre o mesmo grupo de leads do período. */
function montarConversao(
  intervalo: IntervaloDeDatas,
  contexto: Contexto,
): DegrauDaConversao[] {
  const doPeriodo = contexto.leads.filter((lead) =>
    dentroDoIntervalo(diaDoInstante(lead.criado_em), intervalo),
  );
  const ids = new Set(doPeriodo.map((lead) => lead.id));

  // Conjunto de leads, não de consultas: um lead com três consultas conta uma
  // vez, senão o degrau de baixo ficaria maior que o de cima.
  const agendaram = new Set<number>();
  const compareceram = new Set<number>();

  for (const consulta of contexto.agendamentos) {
    if (!ids.has(consulta.lead_id)) continue;
    if (consulta.status !== STATUS_CANCELADA) agendaram.add(consulta.lead_id);
    if (consulta.status === STATUS_COMPARECEU)
      compareceram.add(consulta.lead_id);
  }

  return [
    { etapa: "Total de leads", quantidade: doPeriodo.length },
    { etapa: "Agendamento", quantidade: agendaram.size },
    { etapa: "Comparecimento", quantidade: compareceram.size },
    {
      etapa: "Venda ganha",
      quantidade: doPeriodo.filter((lead) => lead.etapa === ETAPA_GANHA).length,
    },
  ];
}

/**
 * Os pontos de atenção.
 *
 * Todos determinísticos: cada um é uma comparação entre um número do banco e um
 * limiar de `metasPadrao`. Nada de classificação subjetiva nem de texto gerado.
 *
 * A amostra mínima vale para as três taxas: com três consultas no período, uma
 * falta viraria "33% de no-show" e um alerta crítico sobre nada.
 *
 * Não existe aqui o alerta de "lead parado há N dias na etapa". A tabela
 * `lead_etapa_eventos` só recebe linha quando a mudança passa pelo painel
 * (`src/lib/acoes/etapaDoLead.ts`), e nunca para um lead que jamais se moveu —
 * então o cálculo cairia no `criado_em` do lead e diria "parado há 30 dias" para
 * quem a Helô mexeu ontem. Alerta que mente é pior que alerta nenhum.
 */
function montarAlertas(
  resumo: ResumoDoPeriodo,
  fatos: { aguardandoConfirmacao: number; semDesfecho: number },
): AlertaDaVisao[] {
  const alertas: AlertaDaVisao[] = [];
  const metas = metasPadrao;

  if (
    resumo.taxaCancelamento !== null &&
    resumo.agendamentos >= metas.amostraMinima &&
    resumo.taxaCancelamento > metas.tetoCancelamento
  ) {
    alertas.push({
      id: "cancelamento",
      severidade:
        resumo.taxaCancelamento > metas.cancelamentoCritico
          ? "critico"
          : "atencao",
      problema: `${resumo.taxaCancelamento}% dos agendamentos do período foram cancelados, acima do teto de ${metas.tetoCancelamento}%.`,
      acao: `${resumo.cancelamentos} de ${resumo.agendamentos} agendamentos. Vale ouvir as ligações de confirmação antes de culpar a agenda.`,
    });
  }

  if (
    resumo.showRate !== null &&
    resumo.consultasAteAData >= metas.amostraMinima &&
    resumo.showRate < metas.pisoShowRate
  ) {
    alertas.push({
      id: "show-rate",
      severidade:
        resumo.showRate < metas.showRateCritico ? "critico" : "atencao",
      problema: `Comparecimento em ${resumo.showRate}% das consultas que já aconteceram, abaixo do piso de ${metas.pisoShowRate}%.`,
      acao: `${resumo.faltas} faltas em ${resumo.consultasAteAData} consultas até a data.`,
    });
  }

  if (
    resumo.taxaAgendamento !== null &&
    resumo.qualificados >= metas.amostraMinima &&
    resumo.taxaAgendamento < metas.taxaAgendamento
  ) {
    alertas.push({
      id: "taxa-de-agendamento",
      severidade:
        resumo.taxaAgendamento < metas.taxaAgendamento / 2
          ? "critico"
          : "atencao",
      problema: `Só ${resumo.taxaAgendamento}% dos leads qualificados chegaram a agendar, abaixo da meta de ${metas.taxaAgendamento}%.`,
      acao: `${resumo.leadsComAgendamento} de ${resumo.qualificados} leads qualificados do período.`,
      destino: { texto: "Ver funil →", href: "/funil" },
    });
  }

  // Este não é taxa nem comparação com meta: é contagem de fato. Por isso não
  // passa pela amostra mínima — uma consulta sem confirmar já é uma consulta sem
  // confirmar. E não é do período: é o que está em pé daqui para a frente.
  if (fatos.aguardandoConfirmacao > 0) {
    alertas.push({
      id: "aguardando-confirmacao",
      severidade: "atencao",
      problema: `${fatos.aguardandoConfirmacao} ${fatos.aguardandoConfirmacao === 1 ? "consulta marcada ainda não foi confirmada" : "consultas marcadas ainda não foram confirmadas"}.`,
      acao: "Contagem de hoje para frente, independente do período escolhido.",
      destino: { texto: "Ver fila →", href: "/atendimento" },
    });
  }

  // A consulta que passou e ficou em "Agendada" é um buraco: não é
  // comparecimento, não é falta, e não é futuro — então não aparecia em lugar
  // nenhum da tela. Nenhuma taxa pode cobrir isso, porque o desfecho não existe
  // para ser contado. O que existe é o fato de ninguém ter registrado, e é esse
  // fato que vira alerta.
  if (fatos.semDesfecho > 0) {
    alertas.push({
      id: "sem-desfecho",
      severidade: "atencao",
      problema: `${fatos.semDesfecho} ${fatos.semDesfecho === 1 ? "consulta já aconteceu e o status nunca foi atualizado" : "consultas já aconteceram e o status nunca foi atualizado"}.`,
      acao: "Enquanto o status não for Compareceu, Faltou ou Cancelada, essas consultas ficam fora do no-show e do comparecimento.",
      destino: { texto: "Ver fila →", href: "/atendimento" },
    });
  }

  // Crítico antes de atenção; dentro de cada grupo, a ordem em que foram
  // calculados, que vai do agendamento para o comparecimento.
  return alertas.sort((a, b) => {
    if (a.severidade === b.severidade) return 0;
    return a.severidade === "critico" ? -1 : 1;
  });
}

export async function carregarVisaoGeral(
  periodo: PeriodoEscolhido,
  clinicaId: number | null,
): Promise<DadosDaVisaoGeral> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  const anterior = intervaloAnterior(periodo.intervalo);
  const janela: IntervaloDeDatas = {
    de: anterior.de,
    ate: periodo.intervalo.ate,
  };

  // A leitura dos leads já vem cortada pela janela que a tela usa (período
  // atual + anterior). A dos agendamentos não pode vir cortada: a regra de
  // remarcação precisa da fila inteira de consultas de cada lead, e um corte por
  // data quebraria a sequência.
  let leadsDaJanela = supabase
    .from("leads")
    .select("id, etapa, criado_em")
    .gte("criado_em", primeiroInstante(janela))
    .lte("criado_em", ultimoInstante(janela))
    .limit(TETO_DE_LINHAS);

  // Os motivos de perda não têm filtro de período, igual ao comportamento de
  // hoje: é a foto de quem está em "Venda Perdida" agora.
  let perdidos = supabase
    .from("leads")
    .select("id, motivo_perda")
    .eq("etapa", ETAPA_PERDIDA)
    .limit(TETO_DE_LINHAS);

  // Os leads da janela também precisam do motivo, para o cálculo de qualificado.
  let motivosDaJanela = supabase
    .from("leads")
    .select("id, motivo_perda")
    .gte("criado_em", primeiroInstante(janela))
    .lte("criado_em", ultimoInstante(janela))
    .limit(TETO_DE_LINHAS);

  if (clinicaId !== null) {
    leadsDaJanela = leadsDaJanela.eq("clinica_id", clinicaId);
    perdidos = perdidos.eq("clinica_id", clinicaId);
    motivosDaJanela = motivosDaJanela.eq("clinica_id", clinicaId);
  }

  const [
    respostaDosLeads,
    respostaDosMotivosDaJanela,
    respostaDosPerdidos,
    respostaDosAgendamentos,
    respostaDasUnidades,
    respostaDasClinicas,
  ] = await Promise.all([
    leadsDaJanela,
    motivosDaJanela,
    perdidos,
    supabase
      .from("agendamentos")
      .select(
        "id, lead_id, unidade_id, data_consulta, status, fechado_por, confirmada, criado_em",
      )
      .order("criado_em", { ascending: false })
      .limit(TETO_DE_LINHAS),
    // `agendamentos` guarda a unidade, não a clínica. O recorte por cliente
    // passa por aqui — sem isso não há como filtrar consulta por clínica.
    supabase.from("unidades").select("id, clinica_id").limit(TETO_DE_LINHAS),
    supabase
      .from("clinicas")
      .select("id, nome")
      .eq("ativa", true)
      .order("nome")
      .limit(TETO_DE_LINHAS),
  ]);

  const erro =
    respostaDosLeads.error ??
    respostaDosMotivosDaJanela.error ??
    respostaDosPerdidos.error ??
    respostaDosAgendamentos.error ??
    respostaDasUnidades.error ??
    respostaDasClinicas.error;

  if (erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler a visão geral: ${erro.message}`,
    };
  }

  const leads = (respostaDosLeads.data ?? []) as LinhaDeLead[];

  const clinicaDaUnidade = new Map<number, number | null>();
  for (const unidade of (respostaDasUnidades.data ?? []) as {
    id: number;
    clinica_id: number | null;
  }[]) {
    clinicaDaUnidade.set(unidade.id, unidade.clinica_id);
  }

  const todosOsAgendamentos = (respostaDosAgendamentos.data ??
    []) as LinhaDeAgendamento[];

  const agendamentos =
    clinicaId === null
      ? todosOsAgendamentos
      : todosOsAgendamentos.filter(
          (consulta) => clinicaDaUnidade.get(consulta.unidade_id) === clinicaId,
        );

  const motivoDoLead = new Map<number, string | null>();
  for (const linha of (respostaDosMotivosDaJanela.data ?? []) as {
    id: number;
    motivo_perda: string | null;
  }[]) {
    motivoDoLead.set(linha.id, linha.motivo_perda);
  }

  const hoje = diaDeHoje();

  const contexto: Contexto = {
    leads,
    motivoDoLead,
    agendamentos,
    // A remarcação é calculada sobre a fila inteira, antes de qualquer corte de
    // período: é a consulta anterior do lead que decide, e ela pode ser de antes.
    remarcacoes: idsDeRemarcacao(agendamentos),
    hoje,
  };

  const linhasPerdidas = (respostaDosPerdidos.data ?? []) as {
    id: number;
    motivo_perda: string | null;
  }[];

  const motivos: MotivoContado[] = motivosDePerda
    .map((motivo) => ({
      motivo,
      quantidade: linhasPerdidas.filter((lead) => lead.motivo_perda === motivo)
        .length,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const resumoAtual = montarResumo(periodo.intervalo, contexto);

  const aguardandoConfirmacao = agendamentos.filter(
    (consulta) =>
      consulta.confirmada === false &&
      consulta.status === STATUS_AGENDADA &&
      consulta.data_consulta >= hoje,
  ).length;

  // O corte é o mesmo do alerta acima, só do outro lado: ontem para trás. Assim
  // uma consulta nunca aparece nos dois alertas ao mesmo tempo, e a de hoje
  // conta como pendente de confirmação, não como desfecho atrasado — o dia dela
  // ainda não acabou.
  const semDesfecho = agendamentos.filter(
    (consulta) =>
      consulta.status === STATUS_AGENDADA && consulta.data_consulta < hoje,
  ).length;

  return {
    atual: resumoAtual,
    anterior: montarResumo(anterior, contexto),
    conversao: montarConversao(periodo.intervalo, contexto),
    motivos,
    totalPerdidos: linhasPerdidas.length,
    alertas: montarAlertas(resumoAtual, {
      aguardandoConfirmacao,
      semDesfecho,
    }),
    clinicas: (respostaDasClinicas.data ?? []).map((clinica) => ({
      id: clinica.id as number,
      nome: ((clinica.nome as string | null) ?? "").trim() || "Sem nome",
    })),
    falha: null,
    aviso: montarAviso(leads.length, todosOsAgendamentos.length),
  };
}

function montarAviso(leadsLidos: number, agendamentosLidos: number) {
  const avisos: string[] = [];

  if (leadsLidos >= TETO_DE_LINHAS) {
    avisos.push(
      `Esta leitura pega no máximo ${TETO_DE_LINHAS} leads por período. Nada foi perdido no banco, mas os números abaixo podem estar incompletos — vale estreitar o período.`,
    );
  }

  if (agendamentosLidos >= TETO_DE_LINHAS) {
    avisos.push(
      `O histórico de consultas também está limitado a ${TETO_DE_LINHAS} linhas, as mais recentes. Remarcação de consulta mais antiga que isso pode não estar contada.`,
    );
  }

  return avisos.length > 0 ? avisos.join(" ") : null;
}
