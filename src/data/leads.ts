/**
 * O lead é a unidade de dado do sistema: é dele que saem a Fila de Tarefas, o
 * Funil, a Agenda e os Relatórios. Este arquivo guarda o formato do lead e a
 * base histórica; `tarefas.ts` guarda os leads que estão na fila agora, com os
 * campos de operação por cima.
 */

/** Situação do lead no atendimento (não confundir com a decisão da tarefa). */
export type SituacaoLead =
  | "Pendente"
  | "Em Atendimento"
  | "Aguardando Resposta"
  | "Agendado"
  | "Ganho"
  | "Desqualificado";

/** Colunas do Funil, na ordem em que a agência trabalha com os clientes. */
export type EtapaFunil =
  | "Leads Recebidos"
  | "Em Contato"
  | "Outros Contatos"
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "Nutrição"
  | "Agendamento"
  | "Reagendamento"
  | "Comparecimento"
  | "Venda Ganha"
  | "Venda Perdida";

export const etapasFunil: EtapaFunil[] = [
  "Leads Recebidos",
  "Em Contato",
  "Outros Contatos",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "Nutrição",
  "Agendamento",
  "Reagendamento",
  "Comparecimento",
  "Venda Ganha",
  "Venda Perdida",
];

/** Por onde o lead chegou. */
export type OrigemContato =
  | "Meta Ads"
  | "Instagram"
  | "Google Ads"
  | "Indicação"
  | "Site"
  | "WhatsApp";

export const origensContato: OrigemContato[] = [
  "Meta Ads",
  "Instagram",
  "Google Ads",
  "Indicação",
  "Site",
  "WhatsApp",
];

/**
 * Motivos de perda, escolhidos numa lista fechada. Não é texto livre porque
 * este campo alimenta o card "Motivos de perda" da Visão Geral: com texto
 * digitado, cada pessoa escreveria de um jeito e a contagem não fecharia.
 */
export type MotivoPerda =
  | "Clicou errado"
  | "Convênio"
  | "Localização distante"
  | "Perdeu o interesse"
  | "Fechou em outra clínica"
  | "Não atende o procedimento"
  | "Sem dinheiro"
  | "Spam"
  | "Outros";

export const motivosDePerda: MotivoPerda[] = [
  "Clicou errado",
  "Convênio",
  "Localização distante",
  "Perdeu o interesse",
  "Fechou em outra clínica",
  "Não atende o procedimento",
  "Sem dinheiro",
  "Spam",
  "Outros",
];

/**
 * Motivos que significam que nunca houve lead de verdade: clique errado, robô
 * ou procedimento que a clínica não faz. Quem cai aqui não conta como
 * qualificado, mesmo que tenha passado por etapas avançadas antes.
 *
 * "Localização distante" ficou de fora de propósito: era gente de verdade
 * querendo o procedimento, só não deu para atender por logística. Isso é
 * prospect perdido, não lead falso.
 */
/**
 * Perda por logística: o lead era real e queria o procedimento, só não tem como
 * chegar na clínica. Continua contando como qualificado, mas serve de contexto
 * para a taxa de agendamento — ninguém aqui ia agendar.
 */
export const MOTIVO_DISTANCIA: MotivoPerda = "Localização distante";

export const motivosQueDesqualificam: MotivoPerda[] = [
  "Clicou errado",
  "Não atende o procedimento",
  "Spam",
];

/**
 * A situação do lead sai da etapa do Funil, e não de um campo próprio: assim a
 * Fila de Tarefas e o Funil não têm como discordar sobre o mesmo lead.
 */
export function situacaoDaEtapa(etapa: EtapaFunil): SituacaoLead {
  switch (etapa) {
    case "Leads Recebidos":
      return "Pendente";
    case "Em Contato":
    case "Outros Contatos":
    case "F1":
    case "F2":
      return "Em Atendimento";
    case "F3":
    case "F4":
    case "F5":
    case "F6":
    case "F7":
    case "Nutrição":
      return "Aguardando Resposta";
    case "Agendamento":
    case "Reagendamento":
    case "Comparecimento":
      return "Agendado";
    case "Venda Ganha":
      return "Ganho";
    case "Venda Perdida":
      return "Desqualificado";
  }
}

/**
 * Campos que todo lead tem, esteja ele na fila de hoje ou no histórico.
 *
 * As datas são relativas (quantos dias atrás) e não fixas, para o exemplo não
 * envelhecer. Os filtros de período dos Relatórios convertem "este mês" ou uma
 * data digitada numa faixa de dias.
 */
export type Lead = {
  id: number;
  /** Cliente da agência a que o lead pertence. */
  clinicaId: number;
  /** Coluna do Funil. A situação do lead é derivada daqui. */
  etapa: EtapaFunil;
  origem: OrigemContato;
  /** Há quantos dias o lead chegou. É a safra dele. */
  diasAtras: number;
  /** Obrigatório em "Venda Perdida". Escolhido na lista, nunca digitado. */
  motivoPerda?: MotivoPerda;
  /** Obrigatório em "Venda Ganha". Em reais, guardado como número. */
  valorVenda?: number;
  /** Quantas vezes a consulta deste lead precisou ser remarcada. */
  remarcacoes?: number;
};

/**
 * A partir de "Outros Contatos" o lead já passou da triagem: alguém falou com
 * ele e ele seguiu no funil. Antes disso é contato cru.
 */
const PRIMEIRA_ETAPA_QUALIFICADA = etapasFunil.indexOf("Outros Contatos");

/**
 * Qualificado é leitura da etapa, nunca um campo gravado à parte — era assim
 * que fila e relatório passavam a discordar sobre o mesmo lead.
 *
 * Em "Venda Perdida" a etapa não basta, porque todo mundo termina no mesmo
 * lugar: aí vale o motivo. Quem caiu ali por clique errado, spam ou
 * procedimento que a clínica não faz nunca foi lead de verdade, mesmo que
 * tenha avançado antes. Os outros motivos são prospect real que não fechou.
 */
export function ehQualificado(lead: Lead): boolean {
  if (lead.etapa === "Venda Perdida") {
    return !(
      lead.motivoPerda !== undefined &&
      motivosQueDesqualificam.includes(lead.motivoPerda)
    );
  }
  return etapasFunil.indexOf(lead.etapa) >= PRIMEIRA_ETAPA_QUALIFICADA;
}

/** Etapas que o sistema controla sozinho a partir dos agendamentos. */
export const ETAPA_AGENDADO: EtapaFunil = "Agendamento";
export const ETAPA_REMARCAR: EtapaFunil = "Reagendamento";
export const ETAPA_COMPARECEU: EtapaFunil = "Comparecimento";

/** Etapas em que o CRC precisa informar algo ao mover o lead à mão. */
export const ETAPA_GANHA: EtapaFunil = "Venda Ganha";
export const ETAPA_PERDIDA: EtapaFunil = "Venda Perdida";

/** Origens que vêm de campanha paga. O resto é orgânico ou indicação. */
export const origensPagas: OrigemContato[] = ["Meta Ads", "Google Ads"];

export function ehLeadDeMarketing(lead: Lead) {
  return origensPagas.includes(lead.origem);
}
