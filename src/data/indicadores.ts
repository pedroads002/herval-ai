/** Indicadores mostrados acima da tabela da Fila de Tarefas. */
export type Indicador = {
  id: string;
  rotulo: string;
  valor: string;
  /** Texto secundário: percentual, comparação ou alerta. */
  detalhe?: string;
  /** Quando verdadeiro, o detalhe é destacado como alerta. */
  alerta?: boolean;
};

// Números de exemplo. Ainda não vêm de banco nem de API.
export const indicadoresFila: Indicador[] = [
  { id: "recebidos", rotulo: "Leads recebidos", valor: "184", detalhe: "hoje" },
  {
    id: "agendados",
    rotulo: "Leads agendados",
    valor: "47",
    detalhe: "25,5% do total",
  },
  { id: "ativos", rotulo: "Ativos na fila", valor: "38", detalhe: "em aberto" },
  {
    id: "pendentes",
    rotulo: "Pendentes",
    valor: "12",
    detalhe: "3 sem ação há mais de 1h",
    alerta: true,
  },
  {
    id: "atendimento",
    rotulo: "Em atendimento",
    valor: "19",
    detalhe: "com a equipe",
  },
  {
    id: "aguardando",
    rotulo: "Aguardando resposta",
    valor: "23",
    detalhe: "do lead",
  },
  {
    id: "recuperacao",
    rotulo: "Taxa de recuperação",
    valor: "31%",
    detalhe: "leads frios reativados",
  },
  {
    id: "retorno-ia",
    rotulo: "Retorno para IA",
    valor: "68%",
    detalhe: "voltam ao fluxo automático",
  },
];
