/**
 * "IA" = a própria IA executa a ação.
 * "Humano" = a IA só notifica o CRC; o contato é feito por pessoa.
 * "Automática" = disparo de sistema, sem redação da IA.
 */
export type ExecutorRegra = "IA" | "Humano" | "Automática";

export type RegraAutomacao = {
  id: number;
  gatilho: string;
  condicao: string;
  acao: string;
  espera: string;
  executor: ExecutorRegra;
  ativo: boolean;
};

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const regrasIniciais: RegraAutomacao[] = [
  {
    id: 1,
    gatilho: "Lead novo do Meta Ads",
    condicao: "Primeiro contato ainda não realizado",
    // Regra de ouro: primeiro contato de lead novo nunca é da IA.
    acao: "Notificar CRC: ligar em até 5 min",
    espera: "Imediato",
    executor: "Humano",
    ativo: true,
  },
  {
    id: 2,
    gatilho: "Lead novo do site",
    condicao: "Primeiro contato ainda não realizado",
    acao: "Notificar CRC: ligar em até 5 min",
    espera: "Imediato",
    executor: "Humano",
    ativo: true,
  },
  {
    id: 3,
    gatilho: "Sem resposta há 48h",
    condicao: "Lead já teve o primeiro contato humano",
    acao: "Enviar mensagem de reativação no WhatsApp",
    espera: "48h após a última mensagem",
    executor: "IA",
    ativo: true,
  },
  {
    id: 4,
    gatilho: "Orçamento enviado sem retorno",
    condicao: "Orçamento entregue e sem resposta",
    acao: "Oferecer parcelamento em 12x",
    espera: "24h após o envio",
    executor: "IA",
    ativo: true,
  },
  {
    id: 5,
    gatilho: "Objeção de preço detectada",
    condicao: "Mensagem do lead cita valor ou desconto",
    acao: "Responder com quebra de objeção padrão",
    espera: "Imediato",
    executor: "IA",
    ativo: true,
  },
  {
    id: 6,
    gatilho: "Agendamento não confirmado",
    condicao: "Consulta marcada e ainda sem confirmação",
    acao: "Pedir confirmação da consulta",
    espera: "24h antes da consulta",
    executor: "Automática",
    ativo: true,
  },
  {
    id: 7,
    gatilho: "Cliente antigo inativo",
    condicao: "Sem interação há 6 meses ou mais",
    acao: "Convidar para avaliação de retorno",
    espera: "180 dias sem contato",
    executor: "IA",
    ativo: true,
  },
  {
    id: 8,
    gatilho: "Follow-up D+1",
    condicao: "Lead sem resposta após o primeiro contato",
    acao: "Retomar conversa e oferecer horário",
    espera: "1 dia",
    executor: "IA",
    ativo: true,
  },
  {
    id: 9,
    gatilho: "Follow-up D+2",
    condicao: "Lead segue sem responder",
    acao: "Enviar prova social (antes e depois)",
    espera: "2 dias",
    executor: "IA",
    ativo: true,
  },
  {
    id: 10,
    gatilho: "Follow-up D+3",
    condicao: "Lead segue sem responder",
    acao: "Perguntar se prefere atendimento por telefone",
    espera: "3 dias",
    executor: "IA",
    ativo: true,
  },
  {
    id: 11,
    gatilho: "Follow-up D+5",
    condicao: "Lead segue sem responder",
    acao: "Reforçar condição de pagamento",
    espera: "5 dias",
    executor: "IA",
    ativo: false,
  },
  {
    id: 12,
    gatilho: "Follow-up D+7",
    condicao: "Lead segue sem responder",
    acao: "Última tentativa e encerramento cordial",
    espera: "7 dias",
    executor: "IA",
    ativo: true,
  },
  {
    id: 13,
    gatilho: "Confirmação de consulta · D-2",
    condicao: "Consulta agendada para daqui a 2 dias",
    acao: "Lembrete com data, horário e unidade",
    espera: "48h antes",
    executor: "Automática",
    ativo: true,
  },
  {
    id: 14,
    gatilho: "Confirmação de consulta · D-1",
    condicao: "Consulta agendada para o dia seguinte",
    acao: "Pedir confirmação e orientar chegada",
    espera: "24h antes",
    executor: "Automática",
    ativo: true,
  },
  {
    id: 15,
    gatilho: "Confirmação de consulta · no dia",
    condicao: "Consulta marcada para hoje",
    acao: "Lembrete 3h antes do horário",
    espera: "3h antes",
    executor: "Automática",
    ativo: true,
  },
  {
    id: 16,
    gatilho: "Falta na consulta (no-show)",
    condicao: "Lead não compareceu no horário marcado",
    acao: "Notificar CRC para remarcar por telefone",
    espera: "2h após o horário",
    executor: "Humano",
    ativo: true,
  },
];
