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
  "Meta Ads" | "Instagram" | "Google Ads" | "Indicação" | "Site" | "WhatsApp";

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
  /** Quantas vezes a consulta deste lead precisou ser remarcada. */
  remarcacoes?: number;
  /**
   * Se o lead escreveu depois da primeira mensagem da clínica. Ver
   * `idsQueResponderam`, em `lib/dados/respostas.ts`.
   */
  respondeu?: boolean;
};

/**
 * A partir de "F1" o lead já passou da triagem: alguém falou com ele e ele
 * seguiu no funil. Antes disso é contato cru.
 *
 * Até 17/11/2026 o corte era "Outros Contatos", e isso estava errado: aquela
 * etapa é onde a clínica guarda quem **não** é paciente — o número da própria
 * clínica, fornecedor, a própria agência. É a etapa em que a Helô tem proibição
 * de falar, justamente porque ali não há lead. Com o corte antigo, 21 contatos
 * desses entravam no denominador da taxa de agendamento sem nenhuma chance de
 * virar consulta, e a taxa aparecia 3 pontos pior do que é.
 *
 * O lead continua na etapa onde está e aparecendo na tela; só para de contar
 * como oportunidade de venda.
 */
const PRIMEIRA_ETAPA_QUALIFICADA = etapasFunil.indexOf("F1");

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

/**
 * Lead que conversou com a clínica: respondeu depois da primeira mensagem
 * dela. É a base da taxa "agendamento sobre quem respondeu".
 *
 * Existe ao lado de `ehQualificado`, sem substituí-lo (decisão dele, em
 * 25/11/2026). "Qualificado" é a etapa a partir de F1, e a escada leva para F1
 * quem ficou 24h sem responder: em novembro, 93 dos 243 qualificados da
 * clínica 39 nunca responderam. No sentido contrário, quem conversa e fica em
 * "Em Contato" não entrava em base nenhuma. A taxa sobre quem respondeu mede
 * o trabalho da conversa; a taxa sobre qualificados continua sendo a da meta.
 *
 * Fica de fora o que não é lead: "Outros Contatos" e a perda por clique
 * errado, spam ou procedimento que a clínica não faz.
 */
export function respondeuAClinica(lead: Lead): boolean {
  if (lead.respondeu !== true) return false;
  return ehLeadDeVerdade(lead.etapa, lead.motivoPerda ?? null);
}

/**
 * Se o contato é lead: não está em "Outros Contatos" nem foi perdido por um
 * motivo que diz que nunca foi lead. Recebe os campos soltos porque a Visão
 * Geral lê do banco e não monta um `Lead` inteiro.
 */
export function ehLeadDeVerdade(etapa: string, motivo: string | null): boolean {
  if (etapa === ETAPA_SEM_LEAD) return false;
  if (etapa === "Venda Perdida") {
    return !(
      motivo !== null && motivosQueDesqualificam.includes(motivo as MotivoPerda)
    );
  }
  return true;
}

/**
 * A etapa em que a clínica guarda quem **não** é paciente: o próprio número da
 * clínica, fornecedor, a agência. Ver o comentário de
 * `PRIMEIRA_ETAPA_QUALIFICADA` — ali não há lead, e por isso ela fica fora das
 * contas de oportunidade e de atendimento.
 */
export const ETAPA_SEM_LEAD: EtapaFunil = "Outros Contatos";

/**
 * Se o lead já está numa etapa que só se alcança depois de alguém ter falado
 * com ele.
 *
 * O corte é o mesmo de `ehQualificado`, e de propósito não é a posição de "Em
 * Contato" na lista: "Outros Contatos" vem depois dela na ordem do funil e não
 * é contato nenhum.
 *
 * Existe para a Fila de Atendimento. Lead que a equipe atendeu por telefone e
 * puxou direto para Agendamento não tem o evento de entrada em "Em Contato", e
 * sem isso ele aparecia como alguém que ninguém atendeu — inclusive quem já
 * compareceu à consulta.
 */
export function passouDoContato(etapa: EtapaFunil): boolean {
  return etapasFunil.indexOf(etapa) >= PRIMEIRA_ETAPA_QUALIFICADA;
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
