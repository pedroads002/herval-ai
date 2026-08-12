import { situacaoDaEtapa, type SituacaoLead, type Tarefa } from "@/data/tarefas";

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

/** Minutos sem ação a partir dos quais a tarefa entra no alerta do card. */
const LIMITE_SEM_ACAO = 60;

/**
 * Os cards são calculados a partir das próprias tarefas, e não de números
 * soltos, para nunca divergirem do que a tabela mostra. "Ativos na fila" é
 * exatamente Pendentes + Em atendimento + Aguardando resposta.
 */
export function calcularIndicadoresFila(tarefas: Tarefa[]): Indicador[] {
  const porSituacao = (situacao: SituacaoLead) =>
    tarefas.filter((t) => situacaoDaEtapa(t.etapa) === situacao).length;

  const recebidos = tarefas.length;
  const pendentes = porSituacao("Pendente");
  const emAtendimento = porSituacao("Em Atendimento");
  const aguardando = porSituacao("Aguardando Resposta");
  const agendados = porSituacao("Agendado");
  const ativos = pendentes + emAtendimento + aguardando;

  const semAcao = tarefas.filter(
    (t) =>
      situacaoDaEtapa(t.etapa) === "Pendente" &&
      t.minutosSemAcao > LIMITE_SEM_ACAO,
  ).length;

  return [
    {
      id: "recebidos",
      rotulo: "Leads recebidos",
      valor: String(recebidos),
      detalhe: "na base de hoje",
    },
    {
      id: "agendados",
      rotulo: "Leads agendados",
      valor: String(agendados),
      // Deixa explícito que é a fila de agora, e não o total do período
      // mostrado no card "Agendamentos" da Visão Geral.
      detalhe: `${agendados} de ${recebidos} na base atual da fila`,
    },
    {
      id: "ativos",
      rotulo: "Ativos na fila",
      valor: String(ativos),
      detalhe: `${pendentes} + ${emAtendimento} + ${aguardando}`,
    },
    {
      id: "pendentes",
      rotulo: "Pendentes",
      valor: String(pendentes),
      detalhe:
        semAcao > 0
          ? `${semAcao} sem ação há mais de 1h`
          : "nenhuma sem ação há mais de 1h",
      alerta: semAcao > 0,
    },
    {
      id: "atendimento",
      rotulo: "Em atendimento",
      valor: String(emAtendimento),
      detalhe: "com a equipe",
    },
    {
      id: "aguardando",
      rotulo: "Aguardando resposta",
      valor: String(aguardando),
      detalhe: "do lead",
    },
    // Métricas históricas: não saem da fila de hoje, seguem como exemplo fixo.
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
}
