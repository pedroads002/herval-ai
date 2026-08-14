import { agendamentosIniciais, type Agendamento } from "@/data/agendamentos";
import { clinicasIniciais, type Clinica } from "@/data/clinicas";
import {
  ehLeadDeMarketing,
  ehQualificado,
  ETAPA_GANHA,
  MOTIVO_DISTANCIA,
  type Lead,
} from "@/data/leads";
import { leadsHistoricos } from "@/data/leadsHistoricos";
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
 * A base completa de leads: os que estão na fila agora mais as safras
 * anteriores. Recebe a fila por parâmetro para acompanhar o que o usuário mexeu
 * no Funil sem recarregar a página.
 */
export function baseDeLeads(daFila: Lead[]): Lead[] {
  return [...daFila, ...leadsHistoricos];
}

export const percentualCru = (parte: number, total: number) =>
  total === 0 ? 0 : (parte / total) * 100;

/** Percentual arredondado; devolve null quando não há base para calcular. */
export function taxa(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round(percentualCru(parte, total));
}

// --- Linhas por clínica ----------------------------------------------------

/** Uma linha da tabela "Funil de marketing", pela data da consulta. */
export type LinhaFunil = {
  clinica: Clinica;
  leads: number;
  desqualificados: number;
  qualificados: number;
  /** Consultas marcadas para o período, de qualquer safra. */
  agendados: number;
  ateAData: number;
  consultaFutura: number;
  compareceram: number;
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
  orcamento: number;
};

/** Uma linha da tabela "Follow", colheita de safras anteriores. */
export type LinhaFollow = {
  clinica: Clinica;
  agendadosDeSafraAnterior: number;
  vendasDeSafraAnterior: number;
  orcamento: number;
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
  showRate: number | null;
};

type Entrada = {
  leads: Lead[];
  agendamentos?: Agendamento[];
  faixa: Faixa;
  clinicas?: Clinica[];
};

function porClinica<T>(
  clinicas: Clinica[],
  monta: (clinica: Clinica) => T,
): T[] {
  return clinicas.map(monta);
}

/**
 * Funil de marketing: conta os leads pela safra (quando chegaram) e as consultas
 * que caem no período, venham de qual safra vierem.
 */
export function montarFunil({
  leads,
  agendamentos = agendamentosIniciais,
  faixa,
  clinicas = clinicasIniciais,
}: Entrada): LinhaFunil[] {
  return porClinica(clinicas, (clinica) => {
    const daClinica = leads.filter(
      (l) =>
        l.clinicaId === clinica.id &&
        ehLeadDeMarketing(l) &&
        dentroDaFaixa(l.diasAtras, faixa),
    );

    const qualificados = daClinica.filter(ehQualificado).length;

    // Consultas marcadas PARA o período, de qualquer safra de lead. Quando o
    // período alcança dias que ainda não chegaram, as consultas já marcadas
    // para eles entram aqui como "consulta futura".
    const consultas = agendamentos.filter(
      (a) =>
        a.clinicaId === clinica.id &&
        a.status !== "Cancelada" &&
        dentroDaFaixa(a.consultaEmDias, faixa),
    );

    const jaAconteceram = consultas.filter((a) => a.consultaEmDias >= 0);
    const futuras = consultas.filter((a) => a.consultaEmDias < 0);
    const compareceram = jaAconteceram.filter((a) => a.status === "Compareceu");

    const comConsulta = new Set(
      agendamentos.filter((a) => a.status !== "Cancelada").map((a) => a.leadId),
    );
    const agendadosDaSafra = daClinica.filter(
      (l) => ehQualificado(l) && comConsulta.has(l.id),
    ).length;

    return {
      clinica,
      leads: daClinica.length,
      desqualificados: daClinica.length - qualificados,
      qualificados,
      agendados: consultas.length,
      ateAData: jaAconteceram.length,
      consultaFutura: futuras.length,
      compareceram: compareceram.length,
      taxaComparecimento: taxa(compareceram.length, jaAconteceram.length),
      agendadosDaSafra,
      taxaAgendamento: taxa(agendadosDaSafra, qualificados),
      inalcancaveis: daClinica.filter(
        (l) => ehQualificado(l) && l.motivoPerda === MOTIVO_DISTANCIA,
      ).length,
      orcamento: compareceram.reduce((s, a) => s + (a.valorOrcamento ?? 0), 0),
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
  agendamentos = agendamentosIniciais,
  faixa,
  clinicas = clinicasIniciais,
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
      orcamento: compareceram.reduce((s, a) => s + (a.valorOrcamento ?? 0), 0),
    };
  });
}

/** Produção: conta pelo ato de agendar. Remarcou, conta de novo. */
export function montarProducao({
  agendamentos = agendamentosIniciais,
  faixa,
  clinicas = clinicasIniciais,
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
    const ateAData = vivos.filter((a) => a.consultaEmDias >= 0);
    const futuras = vivos.filter((a) => a.consultaEmDias < 0);
    const compareceram = ateAData.filter((a) => a.status === "Compareceu");

    return {
      clinica,
      agendamentos: doPeriodo.length,
      remarcacoes: doPeriodo.filter((a) => remarcacoes.has(a.id)).length,
      cancelados: cancelados.length,
      consultaAteAData: ateAData.length,
      consultaFutura: futuras.length,
      compareceram: compareceram.length,
      showRate: taxa(compareceram.length, ateAData.length),
    };
  });
}

// --- Indicadores do topo ---------------------------------------------------

export type ResumoGeral = {
  leadsMarketing: number;
  qualificados: number;
  agendadosFunil: number;
  consultaFutura: number;
  taxaAgendamento: number | null;
  /** Qualificados do período perdidos por distância. Contexto da taxa acima. */
  inalcancaveis: number;
  producao: number;
  producaoCompareceu: number;
  producaoAteAData: number;
  showRateProducao: number | null;
  /** Agendamentos do período que são remarcação, e o percentual deles. */
  remarcacoes: number;
  taxaReagendamento: number | null;
  /** Consultas dessa produção que já passaram e o paciente não apareceu. */
  faltas: number;
  taxaNoShow: number | null;
  fechadosPelaIa: number;
  fechadosPeloCrc: number;
  percentualIa: number | null;
};

export function montarResumo(
  funil: LinhaFunil[],
  producao: LinhaProducao[],
  agendamentos: Agendamento[],
  faixa: Faixa,
): ResumoGeral {
  const soma = <T,>(lista: T[], campo: (item: T) => number) =>
    lista.reduce((total, item) => total + campo(item), 0);

  const qualificados = soma(funil, (l) => l.qualificados);
  const agendadosFunil = soma(funil, (l) => l.agendados);
  const agendadosDaSafra = soma(funil, (l) => l.agendadosDaSafra);
  const producaoAteAData = soma(producao, (l) => l.consultaAteAData);
  const producaoCompareceu = soma(producao, (l) => l.compareceram);

  const doPeriodo = agendamentos.filter((a) =>
    dentroDaFaixa(a.criadoHaDias, faixa),
  );
  const pelaIa = doPeriodo.filter((a) => a.fechadoPor === "IA").length;

  const totalProducao = soma(producao, (l) => l.agendamentos);
  const remarcacoes = soma(producao, (l) => l.remarcacoes);
  // No-show é o avesso do show-rate, sobre as consultas que já aconteceram.
  const faltas = producaoAteAData - producaoCompareceu;

  return {
    leadsMarketing: soma(funil, (l) => l.leads),
    qualificados,
    agendadosFunil,
    consultaFutura: soma(funil, (l) => l.consultaFutura),
    taxaAgendamento: taxa(agendadosDaSafra, qualificados),
    inalcancaveis: soma(funil, (l) => l.inalcancaveis),
    producao: totalProducao,
    producaoCompareceu,
    producaoAteAData,
    showRateProducao: taxa(producaoCompareceu, producaoAteAData),
    remarcacoes,
    taxaReagendamento: taxa(remarcacoes, totalProducao),
    faltas,
    taxaNoShow: taxa(faltas, producaoAteAData),
    fechadosPelaIa: pelaIa,
    fechadosPeloCrc: doPeriodo.length - pelaIa,
    percentualIa: taxa(pelaIa, doPeriodo.length),
  };
}

// --- Funil de conversão ----------------------------------------------------

export type Degrau = { etapa: string; quantidade: number };

/**
 * Os quatro degraus da Visão Geral, sempre sobre o mesmo grupo de gente: os
 * leads de marketing que chegaram no período. Cada degrau é um subconjunto do
 * anterior, então a queda entre eles é queda de verdade, e não comparação
 * entre grupos diferentes.
 *
 * Agendamento e comparecimento saem dos agendamentos; venda ganha sai da etapa
 * do Funil, que é onde o CRC registra o valor da venda.
 */
export function montarConversao({
  leads,
  agendamentos = agendamentosIniciais,
  faixa,
  clinicas = clinicasIniciais,
}: Entrada): Degrau[] {
  const daClinica = new Set(clinicas.map((c) => c.id));

  const safra = leads.filter(
    (l) =>
      daClinica.has(l.clinicaId) &&
      ehLeadDeMarketing(l) &&
      dentroDaFaixa(l.diasAtras, faixa),
  );

  const daSafra = new Set(safra.map((l) => l.id));
  const doGrupo = agendamentos.filter((a) => daSafra.has(a.leadId));

  const marcaram = new Set(
    doGrupo.filter((a) => a.status !== "Cancelada").map((a) => a.leadId),
  );
  const compareceram = new Set(
    doGrupo.filter((a) => a.status === "Compareceu").map((a) => a.leadId),
  );

  return [
    { etapa: "Total de leads", quantidade: safra.length },
    { etapa: "Agendamento", quantidade: marcaram.size },
    { etapa: "Comparecimento", quantidade: compareceram.size },
    {
      etapa: "Venda ganha",
      quantidade: safra.filter((l) => l.etapa === ETAPA_GANHA).length,
    },
  ];
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
): Alerta[] {
  const alertas: Alerta[] = [];
  const porClinicaId = new Map(producao.map((l) => [l.clinica.id, l]));

  for (const linha of funil) {
    const prod = porClinicaId.get(linha.clinica.id);
    const nome = linha.clinica.nome;

    if (prod && prod.agendamentos >= metas.amostraMinima) {
      const cancelamento = percentualCru(prod.cancelados, prod.agendamentos);

      if (cancelamento > metas.tetoCancelamento) {
        const critico = cancelamento > metas.cancelamentoCritico;
        alertas.push({
          id: `cancelamento-${linha.clinica.id}`,
          clinica: nome,
          severidade: critico ? "critico" : "atencao",
          problema: `${Math.round(cancelamento)}% dos agendamentos do período foram cancelados (meta: até ${metas.tetoCancelamento}%).`,
          acao: "Investigar causa do cancelamento e rodar confirmação ativa D-1.",
        });
      }
    }

    if (
      prod &&
      prod.showRate !== null &&
      prod.consultaAteAData >= metas.amostraMinima &&
      prod.showRate < metas.pisoShowRate
    ) {
      const critico = prod.showRate < metas.showRateCritico;
      alertas.push({
        id: `showrate-${linha.clinica.id}`,
        clinica: nome,
        severidade: critico ? "critico" : "atencao",
        problema: `Show-rate de ${prod.showRate}% na produção do período (piso: ${metas.pisoShowRate}%).`,
        acao: "Reforçar lembrete D-1 e D-0 e revisar o intervalo entre marcar e atender.",
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
    funil.leads > 0 ||
    funil.agendados > 0 ||
    (producao?.agendamentos ?? 0) > 0
  );
}
