/** Decisão tomada sobre a tarefa. "Avisado" só vale para alertas humanos. */
export type StatusTarefa = "Pendente" | "Aprovado" | "Rejeitado" | "Avisado";

/**
 * "acao-ia" é uma ação que a IA executa e o humano aprova ou rejeita.
 * "alerta-humano" é um aviso para a equipe agir por conta própria — a IA
 * nunca executa esse contato. É o caso do primeiro contato de lead novo.
 */
export type TipoTarefa = "acao-ia" | "alerta-humano";

/** Quem executa a ação depois de decidida. */
export type Responsavel = "IA" | "Humano" | "Automática";


import {
  type EtapaFunil,
  type Lead,
  type MotivoPerda,
  type SituacaoLead,
} from "@/data/leads";

// Repassados para as telas que já importavam esses tipos daqui.
export {
  etapasFunil,
  motivosDePerda,
  situacaoDaEtapa,
  origensPagas,
  ehLeadDeMarketing,
} from "@/data/leads";
export type {
  EtapaFunil,
  Lead,
  MotivoPerda,
  OrigemContato,
  SituacaoLead,
} from "@/data/leads";

export type NivelScore = "Alta" | "Média" | "Baixa";

/**
 * Uma tarefa é um lead da fila com os campos de operação em cima: qual regra
 * disparou, o que a IA sugere, quanto tempo está parada. Os campos do lead em
 * si (clínica, origem, etapa, safra) vêm de `Lead`, que é o que os relatórios
 * leem — assim a fila e o relatório nunca discordam sobre o mesmo lead.
 *
 * A conversa com o lead não mora mais aqui: virou `mensagens.ts`, entidade
 * própria por lead. Enquanto era campo da tarefa, só quem estava na fila tinha
 * conversa, e só o lado da IA aparecia.
 */
export type Tarefa = Lead & {
  lead: string;
  telefone: string;
  regra: string;
  acao: string;
  tipo: TipoTarefa;
  responsavel: Responsavel;
  status: StatusTarefa;
  /** Há quantos minutos a tarefa está sem nenhuma ação. */
  minutosSemAcao: number;
  /**
   * Horas até o prazo da tarefa. Negativo significa prazo vencido.
   * É relativo (e não uma data fixa) para o exemplo não envelhecer.
   */
  prazoEmHoras: number;
  score: {
    percentual: number;
    nivel: NivelScore;
    motivo: string;
  };
};

// Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
// Quando esta tela passar a ler o banco, é este array que some.
export const tarefasIniciais: Tarefa[] = [];

/** Situações consideradas "ativas" no filtro da fila. */
export const situacoesAtivas: SituacaoLead[] = [
  "Pendente",
  "Em Atendimento",
  "Aguardando Resposta",
];
