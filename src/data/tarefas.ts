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
  /**
   * Nome do cliente da agência, lido de `clinicas` no banco. `clinicasIniciais`
   * está vazio, então `nomeDaClinica` responderia "Clínica removida" para todo
   * lead real — nome errado na tela é pior que nome nenhum. Nulo quando o lead
   * não tem cliente.
   */
  cliente?: string | null;
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
  /**
   * Chance de o lead agendar. **Opcional porque não existe modelo que calcule
   * isso.** Enquanto era obrigatório, qualquer tarefa real precisava inventar
   * um percentual para existir, e a coluna "Score" afirmava uma previsão que
   * ninguém fez. Sem valor, a tela diz "não medido" — o mesmo caminho da Fila
   * de Atendimento nos Relatórios.
   */
  score?: {
    percentual: number;
    nivel: NivelScore;
    motivo: string;
  };
};

// Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
//
// O Funil já não lê daqui — ele lê o banco, por `lib/dados/funil.ts`. Quem ainda
// depende deste array é a Fila de Tarefas, a Visão Geral e os Relatórios, e é por
// isso que ele não pôde sair junto: essas telas mostram score, prazo e regra
// disparada, campos que o banco não tem. Este array some quando cada uma delas
// passar a ler o que existe de verdade.
export const tarefasIniciais: Tarefa[] = [];

/** Situações consideradas "ativas" no filtro da fila. */
export const situacoesAtivas: SituacaoLead[] = [
  "Pendente",
  "Em Atendimento",
  "Aguardando Resposta",
];
