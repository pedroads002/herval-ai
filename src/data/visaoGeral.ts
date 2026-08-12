export type Periodo = "Diário" | "Semanal" | "Mensal";

export const periodos: Periodo[] = ["Diário", "Semanal", "Mensal"];

export type Kpi = {
  id: string;
  rotulo: string;
  valor: string;
  /** Variação percentual contra o período anterior. Negativo cai. */
  variacao?: number;
  detalhe?: string;
};

export type EtapaFunil = {
  etapa: string;
  quantidade: number;
};

export type DadosPeriodo = {
  kpis: Kpi[];
  funil: EtapaFunil[];
};

// Números de exemplo. Ainda não vêm de banco nem de API.
export const dadosVisaoGeral: Record<Periodo, DadosPeriodo> = {
  Diário: {
    kpis: [
      { id: "marketing", rotulo: "Leads de marketing", valor: "184", variacao: 12 },
      {
        id: "agendamentos",
        rotulo: "Agendamentos",
        valor: "47",
        variacao: 8,
        detalhe: "no período selecionado",
      },
      {
        id: "reagendamento",
        rotulo: "Taxa de reagendamento",
        valor: "14%",
        detalhe: "7 consultas remarcadas",
      },
      {
        id: "noshow",
        rotulo: "Taxa de no-show",
        valor: "9%",
        variacao: -3,
        detalhe: "4 faltas",
      },
      {
        id: "origem",
        rotulo: "Origem do agendamento",
        valor: "62% IA",
        detalhe: "38% humano",
      },
    ],
    funil: [
      { etapa: "Total de leads", quantidade: 184 },
      { etapa: "Agendamento", quantidade: 47 },
      { etapa: "Comparecimento", quantidade: 39 },
      { etapa: "Venda ganha", quantidade: 21 },
    ],
  },
  Semanal: {
    kpis: [
      { id: "marketing", rotulo: "Leads de marketing", valor: "1.146", variacao: 6 },
      {
        id: "agendamentos",
        rotulo: "Agendamentos",
        valor: "292",
        variacao: 11,
        detalhe: "no período selecionado",
      },
      {
        id: "reagendamento",
        rotulo: "Taxa de reagendamento",
        valor: "16%",
        detalhe: "47 consultas remarcadas",
      },
      {
        id: "noshow",
        rotulo: "Taxa de no-show",
        valor: "11%",
        variacao: 2,
        detalhe: "32 faltas",
      },
      {
        id: "origem",
        rotulo: "Origem do agendamento",
        valor: "58% IA",
        detalhe: "42% humano",
      },
    ],
    funil: [
      { etapa: "Total de leads", quantidade: 1146 },
      { etapa: "Agendamento", quantidade: 292 },
      { etapa: "Comparecimento", quantidade: 243 },
      { etapa: "Venda ganha", quantidade: 131 },
    ],
  },
  Mensal: {
    kpis: [
      { id: "marketing", rotulo: "Leads de marketing", valor: "4.938", variacao: 9 },
      {
        id: "agendamentos",
        rotulo: "Agendamentos",
        valor: "1.204",
        variacao: -4,
        detalhe: "no período selecionado",
      },
      {
        id: "reagendamento",
        rotulo: "Taxa de reagendamento",
        valor: "15%",
        detalhe: "181 consultas remarcadas",
      },
      {
        id: "noshow",
        rotulo: "Taxa de no-show",
        valor: "10%",
        variacao: -1,
        detalhe: "120 faltas",
      },
      {
        id: "origem",
        rotulo: "Origem do agendamento",
        valor: "61% IA",
        detalhe: "39% humano",
      },
    ],
    funil: [
      { etapa: "Total de leads", quantidade: 4938 },
      { etapa: "Agendamento", quantidade: 1204 },
      { etapa: "Comparecimento", quantidade: 1017 },
      { etapa: "Venda ganha", quantidade: 548 },
    ],
  },
};
