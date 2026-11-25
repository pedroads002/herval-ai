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
  ETAPA_REMARCAR,
  ETAPA_SEM_LEAD,
  ehLeadDeVerdade,
  etapasFunil,
  motivosDePerda,
  motivosQueDesqualificam,
  type MotivoPerda,
} from "@/data/leads";
import { metasPadrao } from "@/data/metas";
import { lerQuemRespondeu } from "@/lib/dados/respostas";
import {
  diaDeHoje,
  intervaloAnterior,
  primeiroInstante,
  ultimoInstante,
  type IntervaloDeDatas,
  type PeriodoEscolhido,
} from "@/lib/visaoGeral/periodo";
import {
  canaisDeFechamento,
  type CanalDeFechamento,
} from "@/lib/acoes/consultaDoFormulario";

/** Ver o mesmo raciocínio em `dados/funil.ts`. */
const TETO_DE_LINHAS = 1000;

/**
 * A primeira etapa que conta como lead qualificado. É o mesmo corte de
 * `ehQualificado` em `src/data/leads.ts`, refeito aqui porque lá a constante não
 * é exportada e a função pede um `Lead` inteiro, que o banco não devolve.
 */
const PRIMEIRA_ETAPA_QUALIFICADA = etapasFunil.indexOf("F1");

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
  hora_consulta: string | null;
  status: string;
  fechado_por: string;
  /** Nulo em consulta marcada antes deste campo existir. */
  canal_fechamento: string | null;
  confirmada: boolean;
  criado_em: string;
};

/**
 * Uma clínica do seletor. `ativa` vem junto porque o seletor marca a pausada,
 * e não a esconde — ver o motivo em `carregarVisaoGeral`.
 */
export type ClinicaDaLista = { id: number; nome: string; ativa: boolean };

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
  /**
   * Contatos do período que ficaram fora de `leads` por estarem em "Outros
   * Contatos". Existe para a tela poder explicar a diferença em vez de o
   * número simplesmente encolher sem motivo visível.
   */
  foraDaConta: number;
  /** Agendamentos pelo ato de agendar: `criado_em` dentro do período. */
  agendamentos: number;
  /** Consultas do período (pela data da consulta) que já aconteceram e tiveram presença. */
  comparecimentos: number;
  vendas: number;
  faltas: number;
  cancelamentos: number;
  /** Consultas do período (pela data da consulta) que já passaram. */
  consultasAteAData: number;
  /** Falta + cancelamento: quem marcou e não foi atendido. */
  naoCompareceram: number;
  /**
   * Quantas consultas têm desfecho registrado — compareceu, faltou ou foi
   * cancelada. É o denominador do show-rate e do no-show, o mesmo para os dois,
   * e não `consultasAteAData`, que inclui a consulta que passou e continua em
   * "Agendada".
   */
  comDesfecho: number;
  /** Já aconteceram e ninguém deu baixa. Não é falta nem presença. */
  aguardandoBaixa: number;
  remarcacoes: number;
  fechadosPelaIa: number;
  fechadosPeloCrc: number;
  /** Desta produção, quantas têm canal de fechamento registrado. */
  comCanalRegistrado: number;
  fechadosPorLigacao: number;
  fechadosPorWhatsapp: number;
  qualificados: number;
  leadsComAgendamento: number;
  /**
   * Leads do período que responderam depois da primeira mensagem da clínica.
   * Ver `respondeuAClinica`, em `data/leads.ts`.
   */
  responderam: number;
  /** Desses, quantos chegaram a ter consulta marcada. */
  responderamComAgendamento: number;
  /** Percentuais; `null` quando não há base para dividir. */
  taxaNoShow: number | null;
  taxaReagendamento: number | null;
  percentualIa: number | null;
  percentualLigacao: number | null;
  showRate: number | null;
  taxaAgendamento: number | null;
  /** Agendamento sobre quem respondeu. Não substitui a taxa da meta. */
  taxaAgendamentoResponderam: number | null;
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
  foraDaConta: 0,
  agendamentos: 0,
  comparecimentos: 0,
  vendas: 0,
  faltas: 0,
  cancelamentos: 0,
  consultasAteAData: 0,
  naoCompareceram: 0,
  comDesfecho: 0,
  aguardandoBaixa: 0,
  remarcacoes: 0,
  fechadosPelaIa: 0,
  fechadosPeloCrc: 0,
  comCanalRegistrado: 0,
  fechadosPorLigacao: 0,
  fechadosPorWhatsapp: 0,
  qualificados: 0,
  leadsComAgendamento: 0,
  responderam: 0,
  responderamComAgendamento: 0,
  taxaNoShow: null,
  taxaReagendamento: null,
  percentualIa: null,
  percentualLigacao: null,
  showRate: null,
  taxaAgendamento: null,
  taxaAgendamentoResponderam: null,
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

/**
 * O que falta para 100% da outra taxa. Para o par show-rate / no-show, que
 * divide pela mesma base e por isso tem de somar 100% exatos.
 *
 * Arredondar as duas em separado não garante isso: com 7 presenças em 8
 * consultas, 87,5% e 12,5% sobem as duas e a tela mostrava 88% + 13% = 101%.
 * Base pequena e divisão caindo no meio é a regra nessas clínicas, não a
 * exceção. Derivando uma da outra, os dois números continuam certos e a soma
 * fecha.
 */
function complementoDa(outra: number | null): number | null {
  return outra === null ? null : 100 - outra;
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

/** A hora atual no fuso de Brasília, "HH:MM" — comparável com `hora_consulta`. */
function horaDeAgora() {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  /** Ids dos leads que responderam à clínica. Ver `lib/dados/respostas.ts`. */
  responderam: Set<number>;
  hoje: string;
  /** A hora atual em Brasília, "HH:MM". Só decide a consulta de hoje. */
  agora: string;
};

/**
 * Se a consulta já aconteceu.
 *
 * O dia não basta: a consulta de hoje às 14h não aconteceu às 8h da manhã, e
 * tratá-la como passada a jogava para dentro das contas de comparecimento antes
 * da hora. Consulta sem hora marcada só conta como passada depois que o dia
 * inteiro terminou — é o mais tarde que ela poderia ter acontecido, e errar para
 * esse lado não inventa desfecho nenhum.
 */
function jaAconteceu(consulta: LinhaDeAgendamento, contexto: Contexto) {
  if (consulta.data_consulta < contexto.hoje) return true;
  if (consulta.data_consulta > contexto.hoje) return false;
  if (consulta.hora_consulta === null) return false;
  return consulta.hora_consulta.slice(0, 5) <= contexto.agora;
}

function montarResumo(
  intervalo: IntervaloDeDatas,
  contexto: Contexto,
): ResumoDoPeriodo {
  const chegaram = contexto.leads.filter((lead) =>
    dentroDoIntervalo(diaDoInstante(lead.criado_em), intervalo),
  );
  // "Outros Contatos" é a etapa em que a clínica guarda quem **não** é paciente
  // — o número dela mesma, fornecedor, a agência. Ali não há lead, e por isso
  // esses contatos não entram em "Leads Recebidos". A Fila de Atendimento já
  // fazia esse corte desde 17/11/2026; até aqui a Visão Geral e o Funil
  // continuavam contando, e as três telas davam dois números diferentes para a
  // mesma pergunta. Eles seguem aparecendo no Funil do Atendimento, onde a
  // equipe trabalha com eles; o que muda é só a contagem.
  const leadsDoPeriodo = chegaram.filter(
    (lead) => lead.etapa !== ETAPA_SEM_LEAD,
  );
  const foraDaConta = chegaram.length - leadsDoPeriodo.length;
  // Ids dos leads qualificados do período — é o universo que `taxaAgendamento`
  // usa como denominador logo abaixo, e precisa ser o mesmo universo do
  // numerador (`comAgendamento`). Antes o numerador contava qualquer lead do
  // período, qualificado ou não, e a taxa podia passar de 100% — mesmo ajuste
  // que `montarFunil`, em `lib/relatorios.ts`, já fazia para `agendadosDaSafra`.
  const idsQualificados = new Set(
    leadsDoPeriodo
      .filter((lead) =>
        ehQualificado(lead.etapa, contexto.motivoDoLead.get(lead.id) ?? null),
      )
      .map((lead) => lead.id),
  );

  // O "ato de agendar": a consulta entra no período em que foi marcada, não no
  // dia em que ela cairia. É o que mede o trabalho do time no período.
  const producao = contexto.agendamentos.filter((consulta) =>
    dentroDoIntervalo(diaDoInstante(consulta.criado_em), intervalo),
  );

  /*
    Comparecimento, falta, cancelamento e no-show contam pelo DIA DA CONSULTA,
    não pelo dia em que ela foi marcada — o mesmo dia que a Agenda mostra.

    Correção de 24/11/2026: até aqui esses números vinham de `producao`, pelo
    `criado_em`. Hoje a clínica teve 4 comparecimentos na Agenda e o card
    mostrava 1, porque só uma das quatro consultas tinha sido marcada hoje; as
    outras três tinham sido marcadas nos dias 11, 13 e 17 e iam para lá. Quem
    abre a tela compara com a Agenda, e as duas precisam dizer a mesma coisa.
    "Agendamentos", remarcação, origem (IA/CRC) e canal continuam pelo ato de
    agendar: eles medem o trabalho de marcar, e esse acontece no `criado_em`.
  */
  const consultasDoPeriodo = contexto.agendamentos.filter((consulta) =>
    dentroDoIntervalo(consulta.data_consulta, intervalo),
  );

  // Consultas do período que já aconteceram. A marcada para mais tarde hoje
  // não pode entrar na conta de falta nem de presença.
  //
  // Sem as canceladas, igual a `montarFunil` em `lib/relatorios.ts`: o
  // cancelamento tem desfecho próprio e não espera baixa. Se entrasse aqui,
  // viraria "consulta sem baixa" em `aguardandoBaixa`, que nunca seria
  // resolvida porque a baixa já existe.
  const jaAconteceram = consultasDoPeriodo.filter(
    (consulta) =>
      consulta.status !== STATUS_CANCELADA && jaAconteceu(consulta, contexto),
  );

  const faltas = jaAconteceram.filter(
    (consulta) => consulta.status === STATUS_FALTOU,
  ).length;
  const comparecimentos = jaAconteceram.filter(
    (consulta) => consulta.status === STATUS_COMPARECEU,
  ).length;
  // Só as canceladas cuja data já passou. O sistema não grava o dia do
  // cancelamento, e contar a consulta de daqui a uma semana já cancelada fazia
  // "Este mês" e "30 dias" darem no-show diferente no mesmo dia (decisão dele,
  // em 24/11/2026).
  const cancelamentos = consultasDoPeriodo.filter(
    (consulta) =>
      consulta.status === STATUS_CANCELADA && jaAconteceu(consulta, contexto),
  ).length;

  /*
    Quem marcou e não foi atendido: falta + cancelamento.

    Decisão dele, em 17/11/2026: para a clínica, cadeira vazia é cadeira vazia,
    e o lead vai para "Reagendamento" nos dois casos. Até aqui o no-show contava
    só "Faltou" e o cancelamento era uma taxa separada — duas taxas para a mesma
    pergunta, e a de no-show vivia zerada porque ninguém marca "Faltou".

    O cancelamento conta quando a data da consulta chega, igual à falta: sem
    o dia do cancelamento gravado, é a única data que todo período enxerga do
    mesmo jeito.
  */
  const naoCompareceram = faltas + cancelamentos;

  // A base das duas taxas de presença, e a mesma para as duas: assim no-show e
  // show-rate somam 100% e param de contar histórias diferentes. Antes elas
  // dividiam por tudo que já tinha acontecido, e aí a consulta que passou sem
  // ninguém dar baixa entrava no denominador: o show-rate caía e o no-show caía
  // junto, os dois por trabalho pendente e não por ausência. Uma consulta sem
  // baixa não tem desfecho para ser contado — ela sai da conta e vira o alerta
  // "sem desfecho", que é o fato que existe de verdade. Mesma regra de
  // `montarProducao`, em `lib/relatorios.ts`.
  const comDesfecho = comparecimentos + naoCompareceram;
  const remarcacoes = producao.filter((consulta) =>
    contexto.remarcacoes.has(consulta.id),
  ).length;

  const fechadosPelaIa = producao.filter(
    (consulta) => consulta.fechado_por === "IA",
  ).length;
  const fechadosPeloCrc = producao.length - fechadosPelaIa;

  // Base própria, e não `producao.length`: o canal só existe para consulta
  // marcada depois dele, e contar o resto como "WhatsApp" por eliminação
  // inventaria dado que ninguém registrou.
  const comCanal = producao.filter(
    (consulta) =>
      consulta.canal_fechamento !== null &&
      canaisDeFechamento.includes(
        consulta.canal_fechamento as CanalDeFechamento,
      ),
  );
  const fechadosPorLigacao = comCanal.filter(
    (consulta) => consulta.canal_fechamento === "Ligação",
  ).length;
  const fechadosPorWhatsapp = comCanal.length - fechadosPorLigacao;

  const qualificados = idsQualificados.size;

  // O no-show sai daqui por complemento, nunca de um arredondamento próprio.
  const showRate = taxa(comparecimentos, comDesfecho);

  // Quantos leads QUALIFICADOS do período chegaram a ter consulta marcada —
  // qualquer uma, em qualquer data, porque o lead é acompanhado até onde
  // chegou. Restrito a qualificados porque é o numerador de `taxaAgendamento`
  // logo abaixo, sobre o denominador `qualificados`.
  const comAgendamento = new Set<number>();
  for (const consulta of contexto.agendamentos) {
    if (
      idsQualificados.has(consulta.lead_id) &&
      consulta.status !== STATUS_CANCELADA
    ) {
      comAgendamento.add(consulta.lead_id);
    }
  }

  // A mesma conta, com outra base: quem respondeu à clínica, e não quem está
  // de F1 em diante. Ver `respondeuAClinica`, em `data/leads.ts`.
  const idsResponderam = new Set(
    leadsDoPeriodo
      .filter(
        (lead) =>
          contexto.responderam.has(lead.id) &&
          ehLeadDeVerdade(
            lead.etapa,
            contexto.motivoDoLead.get(lead.id) ?? null,
          ),
      )
      .map((lead) => lead.id),
  );
  const responderamComAgendamento = new Set<number>();
  for (const consulta of contexto.agendamentos) {
    if (
      idsResponderam.has(consulta.lead_id) &&
      consulta.status !== STATUS_CANCELADA
    ) {
      responderamComAgendamento.add(consulta.lead_id);
    }
  }

  const vendas = leadsDoPeriodo.filter(
    (lead) => lead.etapa === ETAPA_GANHA,
  ).length;

  return {
    leads: leadsDoPeriodo.length,
    foraDaConta,
    agendamentos: producao.length,
    comparecimentos,
    vendas,
    faltas,
    cancelamentos,
    consultasAteAData: jaAconteceram.length,
    comDesfecho,
    naoCompareceram,
    // Sem os cancelados: cancelamento não espera baixa nenhuma.
    aguardandoBaixa: jaAconteceram.length - comparecimentos - faltas,
    remarcacoes,
    fechadosPelaIa,
    fechadosPeloCrc,
    comCanalRegistrado: comCanal.length,
    fechadosPorLigacao,
    fechadosPorWhatsapp,
    qualificados,
    leadsComAgendamento: comAgendamento.size,
    responderam: idsResponderam.size,
    responderamComAgendamento: responderamComAgendamento.size,
    taxaNoShow: complementoDa(showRate),
    taxaReagendamento: taxa(remarcacoes, producao.length),
    percentualIa: taxa(fechadosPelaIa, producao.length),
    percentualLigacao: taxa(fechadosPorLigacao, comCanal.length),
    showRate,
    taxaAgendamento: taxa(comAgendamento.size, qualificados),
    taxaAgendamentoResponderam: taxa(
      responderamComAgendamento.size,
      idsResponderam.size,
    ),
  };
}

/** Os quatro degraus, sempre sobre o mesmo grupo de leads do período. */
function montarConversao(
  intervalo: IntervaloDeDatas,
  contexto: Contexto,
): DegrauDaConversao[] {
  // Mesma base de "Leads Recebidos": sem "Outros Contatos", senão o primeiro
  // degrau ficaria maior que o número do cartão acima dele.
  const doPeriodo = contexto.leads.filter(
    (lead) =>
      lead.etapa !== ETAPA_SEM_LEAD &&
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
  fatos: {
    aguardandoConfirmacao: number;
    semDesfecho: number;
    reagendamentoSemBaixa: number;
  },
): AlertaDaVisao[] {
  const alertas: AlertaDaVisao[] = [];
  const metas = metasPadrao;

  // Não existe mais alerta só de cancelamento: desde 17/11/2026 o cancelamento
  // entra no no-show, e o alerta de show-rate abaixo é o mesmo fato pelo outro
  // lado — dois alertas para a mesma cadeira vazia era o que confundia.

  if (
    resumo.showRate !== null &&
    // A amostra é o que tem desfecho, não tudo que já passou: alertar com base
    // em consulta sem baixa seria alarme falso, porque o número que dispara o
    // alerta não teria vindo de ausência nenhuma.
    resumo.comDesfecho >= metas.amostraMinima &&
    resumo.showRate < metas.pisoShowRate
  ) {
    alertas.push({
      id: "show-rate",
      severidade:
        resumo.showRate < metas.showRateCritico ? "critico" : "atencao",
      problema: `Comparecimento em ${resumo.showRate}% das consultas com desfecho registrado, abaixo do piso de ${metas.pisoShowRate}%.`,
      acao: `${resumo.faltas} faltas e ${resumo.cancelamentos} cancelamentos em ${resumo.comDesfecho} consultas com desfecho registrado.`,
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

  /*
    A etapa diz uma coisa e o status da consulta diz outra.

    Também não é taxa: é contradição entre dois campos do banco, e por isso não
    passa pela amostra mínima. Enquanto ela existe, o no-show está menor do que
    a realidade — e esta é a única forma de a tela dizer isso sem inventar
    falta que ninguém registrou.
  */
  if (fatos.reagendamentoSemBaixa > 0) {
    const um = fatos.reagendamentoSemBaixa === 1;
    alertas.push({
      id: "reagendamento-sem-baixa",
      severidade: "atencao",
      problema: `${fatos.reagendamentoSemBaixa} ${um ? "lead está" : "leads estão"} em "Reagendamento" sem nenhuma consulta marcada como falta ou cancelamento.`,
      acao: `Enquanto a consulta não receber a baixa, ${um ? "esse lead" : "esses leads"} ${um ? "não entra" : "não entram"} no no-show: a taxa fica menor do que a realidade. A etapa do card não alimenta métrica nenhuma.`,
      destino: { texto: "Ver funil →", href: "/funil" },
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
  /*
    Lead sem cliente fica fora das três leituras de lead, pelo `.not` repetido
    abaixo.

    Em "Todas as clínicas" não havia filtro nenhum, então o lead órfão (o que
    está gravado com `clinica_id` vazio) entrava no total desta tela e não
    entrava no dos Relatórios, que confere cliente por cliente e não acha dono
    para ele. As duas telas mostravam números diferentes para o mesmo período,
    sem nada explicando a diferença. Fora da conta nas duas, o total voltou a
    ser a soma dos clientes — e o órfão passa a aparecer no aviso, que é o lugar
    certo de um dado quebrado: visível, em vez de somado em silêncio.

    Com um cliente escolhido o `.eq` já descartava o órfão, então ali nada muda.
  */
  let leadsDaJanela = supabase
    .from("leads")
    .select("id, etapa, criado_em")
    .not("clinica_id", "is", null)
    .gte("criado_em", primeiroInstante(janela))
    .lte("criado_em", ultimoInstante(janela))
    /*
      A ordem existe por causa do teto. Sem `order`, o banco devolve as linhas
      na ordem que quiser: passando de TETO_DE_LINHAS, nem se sabia quais mil
      vinham, e duas aberturas da mesma tela podiam dar números diferentes sem
      nada ter mudado no banco. Com as mais recentes primeiro, o corte passa a
      ser sempre o mesmo e sempre o menos pior — e o aviso de corte, que a tela
      já mostra, diz que ele aconteceu. A leitura de consultas, logo abaixo, já
      fazia isso; as de lead tinham ficado para trás.
    */
    .order("criado_em", { ascending: false })
    .limit(TETO_DE_LINHAS);

  // Os motivos de perda não têm filtro de período, igual ao comportamento de
  // hoje: é a foto de quem está em "Venda Perdida" agora.
  let perdidos = supabase
    .from("leads")
    .select("id, motivo_perda")
    .not("clinica_id", "is", null)
    .eq("etapa", ETAPA_PERDIDA)
    .order("criado_em", { ascending: false })
    .limit(TETO_DE_LINHAS);

  // Os leads da janela também precisam do motivo, para o cálculo de qualificado.
  let motivosDaJanela = supabase
    .from("leads")
    .select("id, motivo_perda")
    .not("clinica_id", "is", null)
    .gte("criado_em", primeiroInstante(janela))
    .lte("criado_em", ultimoInstante(janela))
    .order("criado_em", { ascending: false })
    .limit(TETO_DE_LINHAS);

  /*
    Os leads parados em "Reagendamento", sem corte de período.

    Serve ao alerta de contradição: a etapa diz que a consulta não aconteceu, e
    nenhuma consulta daquele lead está marcada como falta ou cancelamento. É o
    buraco entre o card, que a equipe move à mão, e o status da consulta, que
    alimenta o no-show e o show-rate. Sem corte de data porque lead parado é
    parado — ele não pertence a mês nenhum.
  */
  let emReagendamento = supabase
    .from("leads")
    .select("id")
    .not("clinica_id", "is", null)
    .eq("etapa", ETAPA_REMARCAR)
    .order("id", { ascending: true })
    .limit(TETO_DE_LINHAS);

  if (clinicaId !== null) {
    emReagendamento = emReagendamento.eq("clinica_id", clinicaId);
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
    respostaDosOrfaos,
    respostaDoReagendamento,
    quemRespondeu,
  ] = await Promise.all([
    leadsDaJanela,
    motivosDaJanela,
    perdidos,
    supabase
      .from("agendamentos")
      .select(
        "id, lead_id, unidade_id, data_consulta, hora_consulta, status, fechado_por, canal_fechamento, confirmada, criado_em",
      )
      .order("criado_em", { ascending: false })
      .limit(TETO_DE_LINHAS),
    // `agendamentos` guarda a unidade, não a clínica. O recorte por cliente
    // passa por aqui — sem isso não há como filtrar consulta por clínica.
    // `order` aqui pelo mesmo motivo das leituras de lead: o teto precisa cortar
    // sempre no mesmo lugar. Por id, que é a ordem em que as unidades nasceram.
    supabase
      .from("unidades")
      .select("id, clinica_id")
      .order("id", { ascending: true })
      .limit(TETO_DE_LINHAS),
    // Todos os clientes, inclusive os pausados, e pelo mesmo motivo de
    // `dados/relatorios.ts`: o seletor escreve "(pausada)" ao lado do nome, e
    // esconder o pausado tornava o histórico dele inalcançável — não havia
    // como filtrar a Visão Geral por um cliente que parou, nem para conferir
    // o que ele produziu enquanto estava rodando. As duas telas também
    // ofereciam listas diferentes, então trocar de tela mudava as opções.
    supabase
      .from("clinicas")
      .select("id, nome, ativa")
      .order("nome")
      .limit(TETO_DE_LINHAS),
    // Quantos leads estão sem cliente, para o aviso. Contagem no banco, sem
    // trazer linha nenhuma (`head`), porque aqui só o número interessa — e ela
    // não tem corte de período de propósito: lead órfão é defeito de cadastro,
    // não movimento do mês.
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("clinica_id", null),
    emReagendamento,
    // Só as mensagens da janela: os leads que esta tela conta chegaram dentro
    // dela, e nenhuma mensagem deles é anterior à chegada.
    lerQuemRespondeu(supabase, primeiroInstante(janela)),
  ]);

  const erro =
    respostaDosLeads.error ??
    respostaDosMotivosDaJanela.error ??
    respostaDosPerdidos.error ??
    respostaDosAgendamentos.error ??
    respostaDasUnidades.error ??
    respostaDasClinicas.error ??
    respostaDosOrfaos.error ??
    respostaDoReagendamento.error;

  if (erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler a visão geral: ${erro.message}`,
    };
  }

  if (quemRespondeu.erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler a visão geral: ${quemRespondeu.erro}`,
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
    responderam: quemRespondeu.ids,
    hoje,
    agora: horaDeAgora(),
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

  // Leads em "Reagendamento" sem nenhuma consulta marcada como falta ou
  // cancelamento — inclusive os que não têm consulta nenhuma gravada.
  const leadsComBaixa = new Set(
    agendamentos
      .filter(
        (consulta) =>
          consulta.status === STATUS_FALTOU ||
          consulta.status === STATUS_CANCELADA,
      )
      .map((consulta) => consulta.lead_id),
  );
  const reagendamentoSemBaixa = (
    (respostaDoReagendamento.data ?? []) as { id: number }[]
  ).filter((lead) => !leadsComBaixa.has(lead.id)).length;

  return {
    atual: resumoAtual,
    anterior: montarResumo(anterior, contexto),
    conversao: montarConversao(periodo.intervalo, contexto),
    motivos,
    totalPerdidos: linhasPerdidas.length,
    alertas: montarAlertas(resumoAtual, {
      aguardandoConfirmacao,
      semDesfecho,
      reagendamentoSemBaixa,
    }),
    clinicas: (respostaDasClinicas.data ?? []).map((clinica) => ({
      id: clinica.id as number,
      nome: ((clinica.nome as string | null) ?? "").trim() || "Sem nome",
      ativa: ((clinica.ativa as boolean | null) ?? true) === true,
    })),
    falha: null,
    aviso: montarAviso(
      leads.length,
      todosOsAgendamentos.length,
      respostaDosOrfaos.count ?? 0,
      quemRespondeu.cortado,
    ),
  };
}

function montarAviso(
  leadsLidos: number,
  agendamentosLidos: number,
  semCliente: number,
  mensagensCortadas: boolean,
) {
  const avisos: string[] = [];

  if (mensagensCortadas) {
    avisos.push(
      "A leitura das conversas parou no teto de linhas: o número de quem respondeu pode estar menor do que é.",
    );
  }

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

  // O mesmo texto dos Relatórios, palavra por palavra: é o mesmo defeito, e
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
