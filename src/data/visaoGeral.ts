import type { Faixa } from "@/lib/relatorios";

export type Periodo = "Diário" | "Semanal" | "Mensal";

export const periodos: Periodo[] = ["Diário", "Semanal", "Mensal"];

/**
 * O período vira uma faixa de dias, o mesmo formato que os Relatórios usam.
 * Os números da tela saem todos das funções de `relatorios.ts` a partir daqui:
 * este arquivo não guarda mais nenhum total pronto.
 *
 * A faixa termina em `ate: 0`, ou seja, hoje. Consulta marcada para amanhã não
 * entra na produção de hoje — o que conta é o dia em que a equipe marcou.
 */
export function faixaDoPeriodo(periodo: Periodo): Faixa {
  if (periodo === "Diário") return { de: 0, ate: 0 };
  if (periodo === "Semanal") return { de: 6, ate: 0 };
  return { de: 29, ate: 0 };
}

/** Como cada período se descreve na legenda dos indicadores. */
export const descricaoDoPeriodo: Record<Periodo, string> = {
  Diário: "hoje",
  Semanal: "últimos 7 dias",
  Mensal: "últimos 30 dias",
};

/** A mesma coisa, na forma que cabe no meio de uma frase. */
export const dentroDoPeriodo: Record<Periodo, string> = {
  Diário: "hoje",
  Semanal: "nos últimos 7 dias",
  Mensal: "nos últimos 30 dias",
};
