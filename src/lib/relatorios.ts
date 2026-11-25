import type { Agendamento } from "@/data/agendamentos";
import type { Clinica } from "@/data/clinicas";
import {
  ehLeadDeMarketing,
  ehQualificado,
  ETAPA_REMARCAR,
  ETAPA_SEM_LEAD,
  MOTIVO_DISTANCIA,
  type Lead,
} from "@/data/leads";
import type { Metas } from "@/data/metas";

/**
 * Uma faixa de dias atrás. `de` é o dia mais antigo e `ate` o mais recente,
 * ambos contados para trás a partir de hoje: { de: 6, ate: 0 } são os últimos
 * sete dias, hoje incluído.
 *
 * Todo o relatório trabalha assim porque a base guarda idade, e não data fixa
 * — a mesma escolha do Funil e da Agenda, para o exemplo não envelhecer.
 */
export type Faixa = { de: number; ate: number };

export function dentroDaFaixa(dias: number, faixa: Faixa) {
  return dias >= faixa.ate && dias <= faixa.de;
}

/** Quantos dias a faixa cobre, contando as duas pontas. */
export function tamanhoDaFaixa(faixa: Faixa) {
  return faixa.de - faixa.ate + 1;
}

/**
 * O período imediatamente anterior, do mesmo tamanho: é contra ele que a Visão
 * Geral compara os indicadores.
 */
export function faixaAnterior(faixa: Faixa): Faixa {
  const tamanho = tamanhoDaFaixa(faixa);
  return { de: faixa.de + tamanho, ate: faixa.ate + tamanho };
}

/**
 * Variação percentual contra o período anterior. Devolve nulo quando o período
 * anterior foi zero: dizer "+100%" sobre nada não informa nada.
 */
export function variacao(agora: number, antes: number): number | null {
  if (antes === 0) return null;
  return Math.round(((agora - antes) / antes) * 100);
}

/**
 * Ids dos agendamentos que são remarcação: a consulta anterior daquele lead
 * não aconteceu (faltou ou foi cancelada) e alguém marcou outra. É a mesma
 * contagem do campo `remarcacoes` do lead, só que amarrada ao agendamento —
 * assim ela pode ser recortada por período, o que um contador guardado no lead
 * não permite.
 *
 * Consulta nova depois de um comparecimento não entra: aí é retorno, o
 * paciente veio. Remarcação é refazer trabalho que se perdeu.
 */
export function idsDeRemarcacao(agendamentos: Agendamento[]): Set<number> {
  const porLead = new Map<number, Agendamento[]>();
  for (const agendamento of agendamentos) {
    const lista = porLead.get(agendamento.leadId);
    if (lista) lista.push(agendamento);
    else porLead.set(agendamento.leadId, [agendamento]);
  }

  const ids = new Set<number>();
  for (const lista of porLead.values()) {
    if (lista.length < 2) continue;
    // Do mais antigo para o mais novo: `criadoHaDias` conta para trás, e o id
    // desempata porque a remarcação é sempre criada depois.
    const ordenados = [...lista].sort(
      (a, b) => b.criadoHaDias - a.criadoHaDias || a.id - b.id,
    );
    ordenados.forEach((agendamento, indice) => {
      const anterior = ordenados[indice - 1];
      if (anterior?.status === "Faltou" || anterior?.status === "Cancelada") {
        ids.add(agendamento.id);
      }
    });
  }
  return ids;
}

/**
 * A base completa de leads. Existiu para somar a fila atual com as safras
 * antigas de `leadsHistoricos` — hoje vazio, porque o histórico de exemplo
 * saiu e a tela ainda não lê safra antiga do banco. Enquanto isso não existir,
 * é identidade de propósito: nenhuma chamada deve voltar a depender de um
 * array de fixture por trás dela.
 */
export function baseDeLeads(daFila: Lead[]): Lead[] {
  return daFila;
}

/**
 * Se a consulta já aconteceu no instante `agora`.
 *
 * O dia não basta: a consulta de hoje às 14h não aconteceu às 8h da manhã, e
 * tratá-la como passada a jogava para dentro das contas de comparecimento antes
 * da hora. Agendamento sem hora marcada só conta como passado depois que o dia
 * inteiro terminou — é o mais tarde que ele poderia ter acontecido, e errar para
 * esse lado não inventa desfecho nenhum.
 */
export function jaAconteceu(agendamento: Agendamento, agora: Date): boolean {
  if (agendamento.consultaEmDias > 0) return true;
  if (agendamento.consultaEmDias < 0) return false;

  if (agendamento.hora === null) return false;
  const [hora, minuto] = agendamento.hora.split(":").map(Number);
  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) return false;

  return agora.getHours() * 60 + agora.getMinutes() >= hora * 60 + minuto;
}

/**
 * O desfecho de uma consulta que já aconteceu, do ponto de vista de quem mede
 * comparecimento. "Agendada" depois da hora não é desfecho: é consulta sem
 * baixa, e ela fica de fora das taxas em vez de virar falta por eliminação.
 */
function temDesfecho(agendamento: Agendamento) {
  return agendamento.status === "Compareceu" || agendamento.status === "Faltou";
}

export const percentualCru = (parte: number, total: number) =>
  total === 0 ? 0 : (parte / total) * 100;

/** Percentual arredondado; devolve null quando não há base para calcular. */
export function taxa(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round(percentualCru(parte, total));
}

/**
 * O que falta para 100% da outra taxa. Para o par show-rate / no-show, que
 * divide pela mesma base e por isso tem de somar 100% exatos.
 *
 * Arredondar as duas em separado não garante isso: com 7 presenças em 8
 * consultas, 87,5% e 12,5% sobem as duas e a tela mostrava 88% + 13% = 101%.
 * Base pequena e divisão caindo no meio é a regra nessas clínicas, não a
 * exceção. Derivando uma da outra, os dois números continuam certos e a soma
 * fecha. Mesma regra em `lib/dados/visaoGeral.ts`.
 */
export function complementoDa(outra: number | null): number | null {
  return outra === null ? null : 100 - outra;
}

// --- Linhas por clínica ----------------------------------------------------

/** Uma linha da tabela "Funil de leads", pela data da consulta. */
export type LinhaFunil = {
  clinica: Clinica;
  leads: number;
  /**
   * Contatos do período que ficaram fora de `leads` por estarem em "Outros
   * Contatos". Serve para a legenda da tabela explicar a diferença, do mesmo
   * jeito que a Fila de Atendimento faz.
   */
  foraDaConta: number;
  /**
   * Quantos desses leads chegaram por campanha paga (`origensPagas`).
   *
   * Até 17/11/2026 esta tabela **só** contava esses leads, e a base inteira
   * grava `origem = 'WhatsApp'` na criação do lead: as colunas de lead ficavam
   * zeradas para todas as clínicas e a taxa de agendamento nunca tinha base.
   * Agora o funil conta todo lead, e a origem paga virou este recorte — o dia
   * em que a entrada passar a registrar a campanha, a coluna começa a encher
   * sozinha, sem mexer no resto da conta.
   */
  leadsPagos: number;
  desqualificados: number;
  qualificados: number;
  /** Consultas marcadas para o período, de qualquer safra. */
  agendados: number;
  ateAData: number;
  consultaFutura: number;
  compareceram: number;
  /** Consultas do período que já passaram e foram marcadas como falta. */
  faltaram: number;
  /** Consultas do período que foram canceladas. */
  cancelados: number;
  /**
   * Consultas com desfecho registrado: compareceu, faltou ou foi cancelada. É o
   * denominador de "% compar.", e consulta sem baixa não entra — ela não tem
   * desfecho para somar a uma taxa de presença.
   */
  comDesfecho: number;
  /** Já aconteceram e ninguém registrou o desfecho. Trabalho pendente, não falta. */
  aguardandoBaixa: number;
  taxaComparecimento: number | null;
  /**
   * Quantos dos qualificados desta safra chegaram a marcar consulta. É outro
   * número que "agendados": aqui só entra quem chegou no período, para a taxa
   * comparar o mesmo grupo de gente consigo mesmo e não passar de 100%.
   */
  agendadosDaSafra: number;
  taxaAgendamento: number | null;
  /**
   * Quantos dos qualificados se perderam por distância. Não é métrica nova:
   * serve para ler a taxa de agendamento sabendo quanta gente dela não tinha
   * como agendar.
   */
  inalcancaveis: number;
};

/** Uma linha da tabela "Follow", colheita de safras anteriores. */
export type LinhaFollow = {
  clinica: Clinica;
  agendadosDeSafraAnterior: number;
  vendasDeSafraAnterior: number;
};

/** Uma linha da tabela "Produção", pelo ato de agendar. */
export type LinhaProducao = {
  clinica: Clinica;
  agendamentos: number;
  /** Quantos desses agendamentos são remarcação de uma consulta que falhou. */
  remarcacoes: number;
  cancelados: number;
  consultaAteAData: number;
  consultaFutura: number;
  compareceram: number;
  /** Só quem está marcado "Faltou". Consulta sem baixa não é falta. */
  faltaram: number;
  /** Falta + cancelamento: quem marcou e não foi atendido. */
  naoCompareceram: number;
  /**
   * Compareceu + faltou + cancelado: o denominador honesto do show-rate, e o
   * mesmo do no-show. Ver `naoCompareceram` em `lib/dados/visaoGeral.ts`.
   */
  comDesfecho: number;
  /** Já aconteceram e continuam sem baixa. Ficam fora de toda taxa. */
  aguardandoBaixa: number;
  showRate: number | null;
};

type Entrada = {
  leads: Lead[];
  agendamentos: Agendamento[];
  faixa: Faixa;
  clinicas: Clinica[];
  /**
   * O instante em que a tela está medindo. Vem de fora pelo mesmo motivo dos
   * campos de dia: quem sabe que horas são no fuso do usuário é a tela, não o
   * servidor. Só decide se a consulta de hoje já passou do horário dela.
   */
  agora: Date;
};

function porClinica<T>(
  clinicas: Clinica[],
  monta: (clinica: Clinica) => T,
): T[] {
  return clinicas.map(monta);
}

/**
 * Funil de leads: conta os leads pela safra (quando chegaram) e as consultas
 * que caem no período, venham de qual safra vierem. Todo lead entra, de
 * qualquer origem — a campanha paga aparece na coluna `leadsPagos`.
 */
export function montarFunil({
  leads,
  agendamentos,
  faixa,
  clinicas,
  agora,
}: Entrada): LinhaFunil[] {
  return porClinica(clinicas, (clinica) => {
    const chegaram = leads.filter(
      (l) =>
        l.clinicaId === clinica.id && dentroDaFaixa(l.diasAtras, faixa),
    );
    // Sem "Outros Contatos": ali a clínica guarda quem **não** é paciente, e
    // isso não é lead recebido nem lead desqualificado. Mesmo corte da Fila de
    // Atendimento e da Visão Geral. Ver `ETAPA_SEM_LEAD`, em `data/leads.ts`.
    const daClinica = chegaram.filter((l) => l.etapa !== ETAPA_SEM_LEAD);
    const foraDaConta = chegaram.length - daClinica.length;

    const qualificados = daClinica.filter(ehQualificado).length;
    const leadsPagos = daClinica.filter(ehLeadDeMarketing).length;

    // Consultas marcadas PARA o período, de qualquer safra de lead. Quando o
    // período alcança dias que ainda não chegaram, as consultas já marcadas
    // para eles entram aqui como "consulta futura".
    const consultas = agendamentos.filter(
      (a) =>
        a.clinicaId === clinica.id &&
        a.status !== "Cancelada" &&
        dentroDaFaixa(a.consultaEmDias, faixa),
    );

    // As canceladas ficam fora de `consultas` (elas não ocupam mais a agenda),
    // mas entram na base de comparecimento: desde 17/11/2026 cancelamento é
    // no-show, e precisa ser a mesma base nas duas telas. Ver `naoCompareceram`
    // em `lib/dados/visaoGeral.ts`. Só as que a data já passou, igual à falta.
    const canceladas = agendamentos.filter(
      (a) =>
        a.clinicaId === clinica.id &&
        a.status === "Cancelada" &&
        dentroDaFaixa(a.consultaEmDias, faixa) &&
        jaAconteceu(a, agora),
    ).length;

    const jaAconteceram = consultas.filter((a) => jaAconteceu(a, agora));
    const futuras = consultas.filter((a) => !jaAconteceu(a, agora));
    const compareceram = jaAconteceram.filter((a) => a.status === "Compareceu");
    const comDesfecho = jaAconteceram.filter(temDesfecho).length + canceladas;

    const comConsulta = new Set(
      agendamentos.filter((a) => a.status !== "Cancelada").map((a) => a.leadId),
    );
    const agendadosDaSafra = daClinica.filter(
      (l) => ehQualificado(l) && comConsulta.has(l.id),
    ).length;

    return {
      clinica,
      leads: daClinica.length,
      foraDaConta,
      leadsPagos,
      desqualificados: daClinica.length - qualificados,
      qualificados,
      agendados: consultas.length,
      ateAData: jaAconteceram.length,
      consultaFutura: futuras.length,
      compareceram: compareceram.length,
      faltaram: jaAconteceram.filter((a) => a.status === "Faltou").length,
      cancelados: canceladas,
      comDesfecho,
      // Sem as canceladas: cancelamento não espera baixa nenhuma.
      aguardandoBaixa:
        jaAconteceram.length - jaAconteceram.filter(temDesfecho).length,
      taxaComparecimento: taxa(compareceram.length, comDesfecho),
      agendadosDaSafra,
      taxaAgendamento: taxa(agendadosDaSafra, qualificados),
      inalcancaveis: daClinica.filter(
        (l) => ehQualificado(l) && l.motivoPerda === MOTIVO_DISTANCIA,
      ).length,
    };
  });
}

/**
 * Follow: agendamento feito dentro do período para um lead que chegou antes
 * dele. Não precisa de campo de vínculo — a comparação entre a safra do lead e
 * a data do agendamento já diz isso.
 */
export function montarFollow({
  leads,
  agendamentos,
  faixa,
  clinicas,
}: Entrada): LinhaFollow[] {
  const safraPorLead = new Map(leads.map((l) => [l.id, l.diasAtras]));

  return porClinica(clinicas, (clinica) => {
    const deFollow = agendamentos.filter((a) => {
      if (a.clinicaId !== clinica.id) return false;
      if (!dentroDaFaixa(a.criadoHaDias, faixa)) return false;
      const safra = safraPorLead.get(a.leadId);
      // Lead mais velho que o começo do período: é colheita de safra anterior.
      return safra !== undefined && safra > faixa.de;
    });

    const compareceram = deFollow.filter((a) => a.status === "Compareceu");

    return {
      clinica,
      agendadosDeSafraAnterior: deFollow.length,
      vendasDeSafraAnterior: compareceram.length,
    };
  });
}

/** Produção: conta pelo ato de agendar. Remarcou, conta de novo. */
export function montarProducao({
  agendamentos,
  faixa,
  clinicas,
  agora,
}: Omit<Entrada, "leads"> & { leads?: Lead[] }): LinhaProducao[] {
  // Calculado sobre a lista inteira, e não só sobre o período: o agendamento
  // que falhou antes pode estar fora da faixa e mesmo assim é ele que faz o
  // seguinte ser remarcação.
  const remarcacoes = idsDeRemarcacao(agendamentos);

  return porClinica(clinicas, (clinica) => {
    const doPeriodo = agendamentos.filter(
      (a) => a.clinicaId === clinica.id && dentroDaFaixa(a.criadoHaDias, faixa),
    );

    const cancelados = doPeriodo.filter((a) => a.status === "Cancelada");
    const vivos = doPeriodo.filter((a) => a.status !== "Cancelada");
    const ateAData = vivos.filter((a) => jaAconteceu(a, agora));
    const futuras = vivos.filter((a) => !jaAconteceu(a, agora));
    const compareceram = ateAData.filter((a) => a.status === "Compareceu");
    const faltaram = ateAData.filter((a) => a.status === "Faltou");
    // Falta + cancelamento, a definição de no-show desde 17/11/2026. O
    // cancelamento já tem desfecho no dia em que foi cancelado, por isso não
    // espera a data da consulta chegar.
    const naoCompareceram = faltaram.length + cancelados.length;
    const comDesfecho = compareceram.length + naoCompareceram;

    return {
      clinica,
      agendamentos: doPeriodo.length,
      remarcacoes: doPeriodo.filter((a) => remarcacoes.has(a.id)).length,
      cancelados: cancelados.length,
      consultaAteAData: ateAData.length,
      consultaFutura: futuras.length,
      compareceram: compareceram.length,
      faltaram: faltaram.length,
      naoCompareceram,
      comDesfecho,
      // Sem os cancelados: cancelamento não espera baixa nenhuma.
      aguardandoBaixa: ateAData.length - compareceram.length - faltaram.length,
      showRate: taxa(compareceram.length, comDesfecho),
    };
  });
}

// --- Indicadores do topo ---------------------------------------------------

export type ResumoGeral = {
  /** Leads que chegaram no período, de qualquer origem. */
  leads: number;
  /** Contatos do período que ficaram fora de `leads`: ver `LinhaFunil.foraDaConta`. */
  foraDaConta: number;
  /** Desses, quantos vieram de campanha paga. Ver `LinhaFunil.leadsPagos`. */
  leadsPagos: number;
  qualificados: number;
  agendadosFunil: number;
  consultaFutura: number;
  taxaAgendamento: number | null;
  /** O numerador da taxa acima: qualificados da safra que marcaram consulta. */
  agendadosDaSafra: number;
  /** Qualificados do período perdidos por distância. Contexto da taxa acima. */
  inalcancaveis: number;
  producao: number;
  /*
    Comparecimento, falta, cancelamento e no-show contam pelo DIA DA CONSULTA,
    a mesma base do Funil de leads e da Agenda. Até 24/11/2026 vinham da
    produção (pelo dia em que a consulta foi marcada), e o número não batia com
    a Agenda: consulta marcada dia 11 e atendida hoje contava no dia 11.
  */
  compareceram: number;
  /** Consultas do período que já passaram. */
  consultasAteAData: number;
  /** Das consultas acima, quantas têm desfecho. É a base do show-rate e do no-show. */
  comDesfecho: number;
  /** Já aconteceram e continuam sem baixa: não são falta nem presença. */
  aguardandoBaixa: number;
  showRate: number | null;
  /** Agendamentos do período que são remarcação, e o percentual deles. */
  remarcacoes: number;
  taxaReagendamento: number | null;
  /** Consultas do período que já passaram e o paciente não apareceu. */
  faltas: number;
  /** Consultas do período que foram canceladas. */
  cancelados: number;
  /** Falta + cancelamento, que é o numerador do no-show. */
  naoCompareceram: number;
  taxaNoShow: number | null;
  fechadosPelaIa: number;
  fechadosPeloCrc: number;
  percentualIa: number | null;
  /** Das consultas acima, quantas têm canal de fechamento registrado. */
  comCanalRegistrado: number;
  fechadosPorLigacao: number;
  fechadosPorWhatsapp: number;
  percentualLigacao: number | null;
};

export function montarResumo(
  funil: LinhaFunil[],
  producao: LinhaProducao[],
  agendamentos: Agendamento[],
  faixa: Faixa,
): ResumoGeral {
  const soma = <T>(lista: T[], campo: (item: T) => number) =>
    lista.reduce((total, item) => total + campo(item), 0);

  const qualificados = soma(funil, (l) => l.qualificados);
  const agendadosFunil = soma(funil, (l) => l.agendados);
  const agendadosDaSafra = soma(funil, (l) => l.agendadosDaSafra);
  // Presença pelo dia da consulta: sai do funil, não da produção. Ver o
  // comentário em `ResumoGeral.compareceram`.
  const compareceram = soma(funil, (l) => l.compareceram);
  const comDesfecho = soma(funil, (l) => l.comDesfecho);

  const doPeriodo = agendamentos.filter((a) =>
    dentroDaFaixa(a.criadoHaDias, faixa),
  );
  const pelaIa = doPeriodo.filter((a) => a.fechadoPor === "IA").length;

  // Base própria, e não `doPeriodo.length`: o canal só existe para consulta
  // marcada depois dele, e contar o resto como "WhatsApp" por eliminação
  // inventaria dado que ninguém registrou.
  const comCanal = doPeriodo.filter((a) => a.canalFechamento !== null);
  const porLigacao = comCanal.filter(
    (a) => a.canalFechamento === "Ligação",
  ).length;

  const totalProducao = soma(producao, (l) => l.agendamentos);
  const remarcacoes = soma(producao, (l) => l.remarcacoes);
  // Falta é só o que foi registrado como falta. Antes isto era "já aconteceu
  // menos quem compareceu", e aí toda consulta que ninguém deu baixa virava
  // falta: o no-show subia sozinho por trabalho pendente, não por ausência.
  const faltas = soma(funil, (l) => l.faltaram);
  const cancelados = soma(funil, (l) => l.cancelados);
  const naoCompareceram = faltas + cancelados;
  // O no-show sai daqui por complemento, nunca de um arredondamento próprio.
  const showRate = taxa(compareceram, comDesfecho);

  return {
    leads: soma(funil, (l) => l.leads),
    foraDaConta: soma(funil, (l) => l.foraDaConta),
    leadsPagos: soma(funil, (l) => l.leadsPagos),
    qualificados,
    agendadosFunil,
    consultaFutura: soma(funil, (l) => l.consultaFutura),
    taxaAgendamento: taxa(agendadosDaSafra, qualificados),
    agendadosDaSafra,
    inalcancaveis: soma(funil, (l) => l.inalcancaveis),
    producao: totalProducao,
    compareceram,
    consultasAteAData: soma(funil, (l) => l.ateAData),
    comDesfecho,
    aguardandoBaixa: soma(funil, (l) => l.aguardandoBaixa),
    showRate,
    remarcacoes,
    taxaReagendamento: taxa(remarcacoes, totalProducao),
    faltas,
    cancelados,
    naoCompareceram,
    taxaNoShow: complementoDa(showRate),
    fechadosPelaIa: pelaIa,
    fechadosPeloCrc: doPeriodo.length - pelaIa,
    percentualIa: taxa(pelaIa, doPeriodo.length),
    comCanalRegistrado: comCanal.length,
    fechadosPorLigacao: porLigacao,
    fechadosPorWhatsapp: comCanal.length - porLigacao,
    percentualLigacao: taxa(porLigacao, comCanal.length),
  };
}

// --- Pontos de atenção -----------------------------------------------------

export type Severidade = "critico" | "atencao";

export type Alerta = {
  id: string;
  clinica: string;
  severidade: Severidade;
  problema: string;
  acao: string;
};

/**
 * Gera os alertas a partir dos mesmos números das tabelas, comparados com as
 * metas. Clínicas com pouco volume ficam de fora: percentual sobre três
 * consultas não diz nada e só geraria alarme falso.
 */
export function montarAlertas(
  funil: LinhaFunil[],
  producao: LinhaProducao[],
  metas: Metas,
  /**
   * A base inteira, sem corte de período: o alerta de contradição entre etapa e
   * status olha lead parado, que não pertence a mês nenhum.
   */
  base: { leads: Lead[]; agendamentos: Agendamento[] },
): Alerta[] {
  const alertas: Alerta[] = [];
  // `producao` segue na assinatura para não mexer em quem chama, mas nenhum
  // alerta usa mais: o de comparecimento passou para o dia da consulta, que é
  // o `funil`. Ver `ResumoGeral.compareceram`.
  void producao;

  // Leads que já têm a baixa registrada em alguma consulta. Quem está em
  // "Reagendamento" e não está aqui é a contradição que o alerta aponta.
  const comBaixa = new Set(
    base.agendamentos
      .filter((a) => a.status === "Faltou" || a.status === "Cancelada")
      .map((a) => a.leadId),
  );

  for (const linha of funil) {
    const nome = linha.clinica.nome;

    // Não existe mais alerta só de cancelamento: desde 17/11/2026 o
    // cancelamento entra no no-show, e o alerta de show-rate abaixo é o mesmo
    // fato pelo outro lado. Mesma decisão de `dados/visaoGeral.ts`.

    /*
      A etapa diz uma coisa e o status da consulta diz outra.

      Não é taxa, é contradição entre dois campos do banco — por isso não passa
      pela amostra mínima. Enquanto ela existe, o no-show desta clínica está
      menor do que a realidade. Mesmo alerta da Visão Geral.
    */
    const semBaixa = base.leads.filter(
      (l) =>
        l.clinicaId === linha.clinica.id &&
        l.etapa === ETAPA_REMARCAR &&
        !comBaixa.has(l.id),
    ).length;

    if (semBaixa > 0) {
      const um = semBaixa === 1;
      alertas.push({
        id: `reagendamento-sem-baixa-${linha.clinica.id}`,
        clinica: nome,
        severidade: "atencao",
        problema: `${semBaixa} ${um ? "lead está" : "leads estão"} em "Reagendamento" sem nenhuma consulta marcada como falta ou cancelamento.`,
        acao: `Dar a baixa na consulta que não aconteceu. Sem isso ${um ? "esse lead não entra" : "esses leads não entram"} no no-show, e a taxa fica menor do que a realidade.`,
      });
    }

    // Pelo dia da consulta: a mesma base do card do topo, da Visão Geral e da
    // Agenda.
    if (
      linha.taxaComparecimento !== null &&
      // A amostra do show-rate é o que tem desfecho, não tudo que já passou:
      // alerta em cima de uma consulta com baixa seria alarme falso.
      linha.comDesfecho >= metas.amostraMinima &&
      linha.taxaComparecimento < metas.pisoShowRate
    ) {
      const critico = linha.taxaComparecimento < metas.showRateCritico;
      alertas.push({
        id: `showrate-${linha.clinica.id}`,
        clinica: nome,
        severidade: critico ? "critico" : "atencao",
        problema: `Comparecimento de ${linha.taxaComparecimento}% nas consultas do período (piso: ${metas.pisoShowRate}%).`,
        acao: `${linha.faltaram} faltas e ${linha.cancelados} cancelamentos em ${linha.comDesfecho} consultas com desfecho. Reforçar lembrete D-1 e D-0 e revisar o intervalo entre marcar e atender.`,
      });
    }

    if (
      linha.taxaAgendamento !== null &&
      linha.qualificados >= metas.amostraMinima &&
      linha.taxaAgendamento < metas.taxaAgendamento
    ) {
      alertas.push({
        id: `agendamento-${linha.clinica.id}`,
        clinica: nome,
        severidade:
          linha.taxaAgendamento < metas.taxaAgendamento / 2
            ? "critico"
            : "atencao",
        problema: `${linha.taxaAgendamento}% de agendamento sobre qualificados (meta: ${metas.taxaAgendamento}%).`,
        acao: "Revisar a oferta na abordagem e priorizar retorno rápido nos leads de campanha.",
      });
    }
  }

  const ordem: Record<Severidade, number> = { critico: 0, atencao: 1 };
  return alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}

/** Uma clínica sem nada no período fica escondida por padrão. */
export function temAtividade(
  funil: LinhaFunil,
  producao: LinhaProducao | undefined,
) {
  return (
    funil.leads > 0 || funil.agendados > 0 || (producao?.agendamentos ?? 0) > 0
  );
}
