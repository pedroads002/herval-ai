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
    /*
      Aqui havia mais dois cards, "Taxa de recuperação" e "Retorno para IA",
      com 31% e 68% escritos à mão. Eram exemplo fixo: não saíam da fila, não
      saíam de lugar nenhum.
      Saíram inteiros em vez de virarem zero. Um card dizendo "Taxa de
      recuperação: 0%" afirma um fato — que nenhum lead frio foi reativado —
      e seria tão falso quanto os 31%. Quando existir de onde calcular, os
      dois voltam com número de verdade.
    */
  ];
}
