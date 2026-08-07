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

/** Situação do lead no atendimento (não confundir com a decisão da tarefa). */
export type SituacaoLead =
  | "Pendente"
  | "Em Atendimento"
  | "Aguardando Resposta"
  | "Agendado"
  | "Desqualificado";

export type NivelScore = "Alta" | "Média" | "Baixa";

/** Uma mensagem que a IA enviou ao lead, para rastreabilidade. */
export type EventoHistorico = {
  quando: string;
  mensagem: string;
  regra: string;
};

export type Tarefa = {
  id: number;
  lead: string;
  telefone: string;
  clinica: string;
  regra: string;
  acao: string;
  tipo: TipoTarefa;
  responsavel: Responsavel;
  situacao: SituacaoLead;
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
  historico: EventoHistorico[];
};

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const tarefasIniciais: Tarefa[] = [
  {
    id: 1,
    lead: "Mariana Souza",
    telefone: "(51) 96146-8628",
    clinica: "Unidade Centro",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 300,
    prazoEmHoras: 40,
    score: {
      percentual: 51,
      nivel: "Média",
      motivo: "Pediu horário para esta semana",
    },
    historico: [
      {
        quando: "10/03 14:33",
        mensagem:
          "Oi Mariana, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
      {
        quando: "11/03 09:47",
        mensagem:
          "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
      {
        quando: "11/03 16:20",
        mensagem:
          "Mariana, consigo encaixar você esta semana. Prefere manhã ou tarde?",
        regra: "Pedido de horário",
      },
    ],
  },
  {
    id: 2,
    lead: "Carlos Menezes",
    telefone: "(51) 95919-9604",
    clinica: "Unidade Centro",
    regra: "Confirmação de consulta · D-1",
    acao: "Pedir confirmação da consulta de amanhã",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 90,
    prazoEmHoras: 26,
    score: {
      percentual: 91,
      nivel: "Alta",
      motivo: "Confirmou interesse no procedimento",
    },
    historico: [
      {
        quando: "11/03 09:47",
        mensagem:
          "Carlos, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "11/03 16:20",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 3,
    lead: "Juliana Prado",
    telefone: "(51) 96604-3490",
    clinica: "Unidade Centro",
    regra: "Cliente antigo inativo",
    acao: "Convidar para avaliação de retorno",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 45,
    prazoEmHoras: 8,
    score: {
      percentual: 37,
      nivel: "Baixa",
      motivo: "Abriu o orçamento duas vezes, mas não respondeu",
    },
    historico: [
      {
        quando: "11/03 16:20",
        mensagem:
          "Olá Juliana! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "12/03 08:55",
        mensagem:
          "Juliana, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
    ],
  },
  {
    id: 4,
    lead: "Rafael Lima",
    telefone: "(51) 99137-8474",
    clinica: "Unidade Moinhos",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 160,
    prazoEmHoras: 30,
    score: {
      percentual: 68,
      nivel: "Média",
      motivo: "Pediu horário para esta semana",
    },
    historico: [
      {
        quando: "12/03 08:55",
        mensagem:
          "Oi Rafael, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
    ],
  },
  {
    id: 5,
    lead: "Ana Beatriz Rocha",
    telefone: "(51) 97320-6685",
    clinica: "Unidade Moinhos",
    regra: "Confirmação de consulta · D-1",
    acao: "Pedir confirmação da consulta de amanhã",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 140,
    prazoEmHoras: 20,
    score: {
      percentual: 79,
      nivel: "Alta",
      motivo: "Confirmou interesse no procedimento",
    },
    historico: [
      {
        quando: "12/03 15:40",
        mensagem:
          "Ana, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "13/03 11:05",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 6,
    lead: "Diego Ferraz",
    telefone: "(51) 95709-3119",
    clinica: "Unidade Moinhos",
    regra: "Dúvida sobre o procedimento",
    acao: "Enviar explicação do protocolo",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 2,
    score: {
      percentual: 69,
      nivel: "Média",
      motivo: "Respondeu em menos de 5 minutos",
    },
    historico: [
      {
        quando: "13/03 11:05",
        mensagem:
          "Oi Diego, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
      {
        quando: "13/03 17:38",
        mensagem:
          "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
      {
        quando: "14/03 09:14",
        mensagem:
          "Diego, consigo encaixar você esta semana. Prefere manhã ou tarde?",
        regra: "Pedido de horário",
      },
    ],
  },
  {
    id: 7,
    lead: "Patrícia Nogueira",
    telefone: "(51) 95552-3243",
    clinica: "Unidade Centro",
    regra: "Lead novo do site",
    acao: "Notificar CRC: lead novo, ligar em até 5 min",
    tipo: "alerta-humano",
    responsavel: "Humano",
    situacao: "Pendente",
    status: "Pendente",
    minutosSemAcao: 2,
    prazoEmHoras: 0.1,
    score: {
      percentual: 20,
      nivel: "Baixa",
      motivo: "Interação muito recente",
    },
    historico: [],
  },
  {
    id: 8,
    lead: "Fernando Aquino",
    telefone: "(51) 93887-3478",
    clinica: "Unidade Zona Sul",
    regra: "Pedido de horário",
    acao: "Sugerir três horários disponíveis",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 70,
    prazoEmHoras: 11,
    score: {
      percentual: 71,
      nivel: "Alta",
      motivo: "Demonstrou interesse, mas travou no valor",
    },
    historico: [
      {
        quando: "14/03 09:14",
        mensagem:
          "Oi Fernando, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
    ],
  },
  {
    id: 9,
    lead: "Camila Bertoldo",
    telefone: "(51) 93386-7864",
    clinica: "Unidade Centro",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 130,
    prazoEmHoras: 24,
    score: {
      percentual: 76,
      nivel: "Alta",
      motivo: "Pediu horário para esta semana",
    },
    historico: [
      {
        quando: "14/03 12:26",
        mensagem:
          "Oi Camila, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
      {
        quando: "09/03 10:12",
        mensagem:
          "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
      {
        quando: "10/03 14:33",
        mensagem:
          "Camila, consigo encaixar você esta semana. Prefere manhã ou tarde?",
        regra: "Pedido de horário",
      },
    ],
  },
  {
    id: 10,
    lead: "Lucas Andrade",
    telefone: "(51) 97428-7521",
    clinica: "Unidade Centro",
    regra: "Fora da área de atendimento",
    acao: "Encerrar conversa com mensagem cordial",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Desqualificado",
    status: "Rejeitado",
    minutosSemAcao: 380,
    prazoEmHoras: 60,
    score: {
      percentual: 18,
      nivel: "Baixa",
      motivo: "Buscava apenas tabela de preços",
    },
    historico: [
      {
        quando: "09/03 10:12",
        mensagem:
          "Olá Lucas! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?",
        regra: "Verificação de localização",
      },
    ],
  },
  {
    id: 11,
    lead: "Renata Vasques",
    telefone: "(51) 94420-8219",
    clinica: "Unidade Moinhos",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 130,
    prazoEmHoras: 24,
    score: {
      percentual: 70,
      nivel: "Alta",
      motivo: "Pediu horário para esta semana",
    },
    historico: [
      {
        quando: "10/03 14:33",
        mensagem:
          "Oi Renata, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
    ],
  },
  {
    id: 12,
    lead: "Bruno Tavares",
    telefone: "(51) 91417-2152",
    clinica: "Unidade Zona Sul",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 260,
    prazoEmHoras: -6,
    score: {
      percentual: 50,
      nivel: "Média",
      motivo: "Respondeu em menos de 5 minutos",
    },
    historico: [
      {
        quando: "11/03 09:47",
        mensagem:
          "Oi Bruno, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
    ],
  },
  {
    id: 13,
    lead: "Letícia Camargo",
    telefone: "(51) 98996-8634",
    clinica: "Unidade Centro",
    regra: "Agendamento não confirmado",
    acao: "Confirmar consulta e orientar chegada",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 200,
    prazoEmHoras: 30,
    score: {
      percentual: 84,
      nivel: "Alta",
      motivo: "Confirmou interesse no procedimento",
    },
    historico: [
      {
        quando: "11/03 16:20",
        mensagem:
          "Letícia, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "12/03 08:55",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 14,
    lead: "Gustavo Pinheiro",
    telefone: "(51) 93645-9459",
    clinica: "Unidade Moinhos",
    regra: "Confirmação de consulta · D-1",
    acao: "Pedir confirmação da consulta de amanhã",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 140,
    prazoEmHoras: 20,
    score: {
      percentual: 81,
      nivel: "Alta",
      motivo: "Consulta marcada e orçamento aceito",
    },
    historico: [
      {
        quando: "12/03 08:55",
        mensagem:
          "Gustavo, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "12/03 15:40",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 15,
    lead: "Aline Model",
    telefone: "(51) 99493-7008",
    clinica: "Unidade Centro",
    regra: "Follow-up D+3",
    acao: "Perguntar se prefere atendimento por telefone",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 2,
    score: {
      percentual: 34,
      nivel: "Baixa",
      motivo: "Parou de responder após o valor",
    },
    historico: [
      {
        quando: "12/03 15:40",
        mensagem:
          "Olá Aline! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
    ],
  },
  {
    id: 16,
    lead: "Marcelo Íris",
    telefone: "(51) 94275-9480",
    clinica: "Unidade Centro",
    regra: "Confirmação de consulta · D-1",
    acao: "Pedir confirmação da consulta de amanhã",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 90,
    prazoEmHoras: 26,
    score: {
      percentual: 88,
      nivel: "Alta",
      motivo: "Confirmou interesse no procedimento",
    },
    historico: [
      {
        quando: "13/03 11:05",
        mensagem:
          "Marcelo, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "13/03 17:38",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 17,
    lead: "Vanessa Duarte",
    telefone: "(51) 96640-8327",
    clinica: "Unidade Centro",
    regra: "Sem resposta há 48h",
    acao: "Enviar mensagem de reativação no WhatsApp",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 190,
    prazoEmHoras: -3,
    score: {
      percentual: 50,
      nivel: "Média",
      motivo: "Sem interação nos últimos 6 meses",
    },
    historico: [
      {
        quando: "13/03 17:38",
        mensagem:
          "Olá Vanessa! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "14/03 09:14",
        mensagem:
          "Vanessa, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
      {
        quando: "14/03 12:26",
        mensagem:
          "Ainda dá tempo de garantir o horário desta semana, Vanessa. Quer que eu reserve?",
        regra: "Follow-up D+3",
      },
    ],
  },
  {
    id: 18,
    lead: "Rodrigo Sartori",
    telefone: "(51) 94348-8907",
    clinica: "Unidade Zona Sul",
    regra: "Sem resposta há 48h",
    acao: "Enviar mensagem de reativação no WhatsApp",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 38,
    prazoEmHoras: 5,
    score: {
      percentual: 39,
      nivel: "Baixa",
      motivo: "Abriu o orçamento duas vezes, mas não respondeu",
    },
    historico: [
      {
        quando: "14/03 09:14",
        mensagem:
          "Olá Rodrigo! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "14/03 12:26",
        mensagem:
          "Rodrigo, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
      {
        quando: "09/03 10:12",
        mensagem:
          "Ainda dá tempo de garantir o horário desta semana, Rodrigo. Quer que eu reserve?",
        regra: "Follow-up D+3",
      },
    ],
  },
  {
    id: 19,
    lead: "Priscila Bastos",
    telefone: "(51) 94265-8832",
    clinica: "Unidade Centro",
    regra: "Cliente antigo inativo",
    acao: "Convidar para avaliação de retorno",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 350,
    prazoEmHoras: 55,
    score: {
      percentual: 55,
      nivel: "Média",
      motivo: "Sem interação nos últimos 6 meses",
    },
    historico: [
      {
        quando: "14/03 12:26",
        mensagem:
          "Olá Priscila! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
    ],
  },
  {
    id: 20,
    lead: "Thiago Nunes",
    telefone: "(51) 93081-1451",
    clinica: "Unidade Zona Sul",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 100,
    prazoEmHoras: 18,
    score: {
      percentual: 64,
      nivel: "Média",
      motivo: "Respondeu em menos de 5 minutos",
    },
    historico: [
      {
        quando: "09/03 10:12",
        mensagem:
          "Oi Thiago, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
    ],
  },
  {
    id: 21,
    lead: "Débora Marques",
    telefone: "(51) 93146-1350",
    clinica: "Unidade Zona Sul",
    regra: "Follow-up D+2",
    acao: "Enviar prova social (antes e depois)",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 300,
    prazoEmHoras: 40,
    score: {
      percentual: 63,
      nivel: "Média",
      motivo: "Abriu o orçamento duas vezes, mas não respondeu",
    },
    historico: [
      {
        quando: "10/03 14:33",
        mensagem:
          "Olá Débora! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
    ],
  },
  {
    id: 22,
    lead: "Eduardo Kraemer",
    telefone: "(51) 94486-5799",
    clinica: "Unidade Zona Sul",
    regra: "Agendamento não confirmado",
    acao: "Confirmar consulta e orientar chegada",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 60,
    prazoEmHoras: 5,
    score: {
      percentual: 92,
      nivel: "Alta",
      motivo: "Consulta marcada e orçamento aceito",
    },
    historico: [
      {
        quando: "11/03 09:47",
        mensagem:
          "Eduardo, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "11/03 16:20",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 23,
    lead: "Sabrina Lopes",
    telefone: "(51) 99466-7891",
    clinica: "Unidade Moinhos",
    regra: "Follow-up D+3",
    acao: "Perguntar se prefere atendimento por telefone",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 45,
    prazoEmHoras: 8,
    score: {
      percentual: 59,
      nivel: "Média",
      motivo: "Parou de responder após o valor",
    },
    historico: [
      {
        quando: "11/03 16:20",
        mensagem:
          "Olá Sabrina! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "12/03 08:55",
        mensagem:
          "Sabrina, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
      {
        quando: "12/03 15:40",
        mensagem:
          "Ainda dá tempo de garantir o horário desta semana, Sabrina. Quer que eu reserve?",
        regra: "Follow-up D+3",
      },
    ],
  },
  {
    id: 24,
    lead: "Henrique Vieira",
    telefone: "(51) 98757-2971",
    clinica: "Unidade Moinhos",
    regra: "Sem resposta há 48h",
    acao: "Enviar mensagem de reativação no WhatsApp",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 130,
    prazoEmHoras: 24,
    score: {
      percentual: 44,
      nivel: "Baixa",
      motivo: "Sem interação nos últimos 6 meses",
    },
    historico: [
      {
        quando: "12/03 08:55",
        mensagem:
          "Olá Henrique! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "12/03 15:40",
        mensagem:
          "Henrique, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
      {
        quando: "13/03 11:05",
        mensagem:
          "Ainda dá tempo de garantir o horário desta semana, Henrique. Quer que eu reserve?",
        regra: "Follow-up D+3",
      },
    ],
  },
  {
    id: 25,
    lead: "Natália Brum",
    telefone: "(51) 91691-2601",
    clinica: "Unidade Zona Sul",
    regra: "Só pesquisando preço",
    acao: "Encerrar e manter em base de nutrição",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Desqualificado",
    status: "Rejeitado",
    minutosSemAcao: 420,
    prazoEmHoras: 48,
    score: {
      percentual: 19,
      nivel: "Baixa",
      motivo: "Buscava apenas tabela de preços",
    },
    historico: [
      {
        quando: "12/03 15:40",
        mensagem:
          "Olá Natália! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?",
        regra: "Verificação de localização",
      },
    ],
  },
  {
    id: 26,
    lead: "Felipe Cardoso",
    telefone: "(51) 99391-4267",
    clinica: "Unidade Zona Sul",
    regra: "Fora da área de atendimento",
    acao: "Encerrar conversa com mensagem cordial",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Desqualificado",
    status: "Rejeitado",
    minutosSemAcao: 420,
    prazoEmHoras: 48,
    score: {
      percentual: 12,
      nivel: "Baixa",
      motivo: "Buscava apenas tabela de preços",
    },
    historico: [
      {
        quando: "13/03 11:05",
        mensagem:
          "Olá Felipe! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?",
        regra: "Verificação de localização",
      },
    ],
  },
  {
    id: 27,
    lead: "Larissa Peixoto",
    telefone: "(51) 95253-4319",
    clinica: "Unidade Moinhos",
    regra: "Pedido de horário",
    acao: "Sugerir três horários disponíveis",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 160,
    prazoEmHoras: 30,
    score: {
      percentual: 67,
      nivel: "Média",
      motivo: "Respondeu em menos de 5 minutos",
    },
    historico: [
      {
        quando: "13/03 17:38",
        mensagem:
          "Oi Larissa, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
      {
        quando: "14/03 09:14",
        mensagem:
          "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
    ],
  },
  {
    id: 28,
    lead: "André Salgado",
    telefone: "(51) 92198-4484",
    clinica: "Unidade Zona Sul",
    regra: "Fora da área de atendimento",
    acao: "Encerrar conversa com mensagem cordial",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Desqualificado",
    status: "Rejeitado",
    minutosSemAcao: 500,
    prazoEmHoras: 72,
    score: {
      percentual: 12,
      nivel: "Baixa",
      motivo: "Buscava apenas tabela de preços",
    },
    historico: [
      {
        quando: "14/03 09:14",
        mensagem:
          "Olá André! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?",
        regra: "Verificação de localização",
      },
    ],
  },
  {
    id: 29,
    lead: "Bianca Ferrari",
    telefone: "(51) 98663-4597",
    clinica: "Unidade Moinhos",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 2,
    score: {
      percentual: 72,
      nivel: "Alta",
      motivo: "Respondeu em menos de 5 minutos",
    },
    historico: [
      {
        quando: "14/03 12:26",
        mensagem:
          "Oi Bianca, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
      {
        quando: "09/03 10:12",
        mensagem:
          "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
      {
        quando: "10/03 14:33",
        mensagem:
          "Bianca, consigo encaixar você esta semana. Prefere manhã ou tarde?",
        regra: "Pedido de horário",
      },
    ],
  },
  {
    id: 30,
    lead: "Otávio Barcellos",
    telefone: "(51) 96556-7902",
    clinica: "Unidade Centro",
    regra: "Cliente antigo inativo",
    acao: "Convidar para avaliação de retorno",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 2,
    score: {
      percentual: 47,
      nivel: "Média",
      motivo: "Sem interação nos últimos 6 meses",
    },
    historico: [
      {
        quando: "09/03 10:12",
        mensagem:
          "Olá Otávio! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
    ],
  },
  {
    id: 31,
    lead: "Cristiane Rosa",
    telefone: "(51) 91296-7297",
    clinica: "Unidade Centro",
    regra: "Lead novo do Meta Ads",
    acao: "Notificar CRC: lead novo, ligar em até 5 min",
    tipo: "alerta-humano",
    responsavel: "Humano",
    situacao: "Pendente",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 0.5,
    score: {
      percentual: 20,
      nivel: "Baixa",
      motivo: "Interação muito recente",
    },
    historico: [],
  },
  {
    id: 32,
    lead: "Vinícius Portela",
    telefone: "(51) 91648-3974",
    clinica: "Unidade Moinhos",
    regra: "Sem resposta há 48h",
    acao: "Enviar mensagem de reativação no WhatsApp",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 260,
    prazoEmHoras: -6,
    score: {
      percentual: 47,
      nivel: "Média",
      motivo: "Leu a mensagem e não retornou",
    },
    historico: [
      {
        quando: "11/03 09:47",
        mensagem:
          "Olá Vinícius! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "11/03 16:20",
        mensagem:
          "Vinícius, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
    ],
  },
  {
    id: 33,
    lead: "Manuela Schmitt",
    telefone: "(51) 92465-5572",
    clinica: "Unidade Moinhos",
    regra: "Confirmação de consulta · D-1",
    acao: "Pedir confirmação da consulta de amanhã",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 60,
    prazoEmHoras: 5,
    score: {
      percentual: 81,
      nivel: "Alta",
      motivo: "Consulta marcada e orçamento aceito",
    },
    historico: [
      {
        quando: "11/03 16:20",
        mensagem:
          "Manuela, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "12/03 08:55",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 34,
    lead: "Leandro Fagundes",
    telefone: "(51) 92372-4643",
    clinica: "Unidade Centro",
    regra: "Pedido de horário",
    acao: "Sugerir três horários disponíveis",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 260,
    prazoEmHoras: -6,
    score: {
      percentual: 58,
      nivel: "Média",
      motivo: "Perguntou sobre formas de pagamento",
    },
    historico: [
      {
        quando: "12/03 08:55",
        mensagem:
          "Oi Leandro, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
    ],
  },
  {
    id: 35,
    lead: "Tatiane Moura",
    telefone: "(51) 99632-4906",
    clinica: "Unidade Moinhos",
    regra: "Só pesquisando preço",
    acao: "Encerrar e manter em base de nutrição",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Desqualificado",
    status: "Rejeitado",
    minutosSemAcao: 420,
    prazoEmHoras: 48,
    score: {
      percentual: 10,
      nivel: "Baixa",
      motivo: "Mora em outro estado",
    },
    historico: [
      {
        quando: "12/03 15:40",
        mensagem:
          "Olá Tatiane! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?",
        regra: "Verificação de localização",
      },
    ],
  },
  {
    id: 36,
    lead: "Ricardo Zanella",
    telefone: "(51) 94372-5750",
    clinica: "Unidade Zona Sul",
    regra: "Follow-up D+3",
    acao: "Perguntar se prefere atendimento por telefone",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 190,
    prazoEmHoras: -3,
    score: {
      percentual: 44,
      nivel: "Baixa",
      motivo: "Parou de responder após o valor",
    },
    historico: [
      {
        quando: "13/03 11:05",
        mensagem:
          "Olá Ricardo! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "13/03 17:38",
        mensagem:
          "Ricardo, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
    ],
  },
  {
    id: 37,
    lead: "Isabela Trindade",
    telefone: "(51) 99284-4104",
    clinica: "Unidade Centro",
    regra: "Follow-up D+3",
    acao: "Perguntar se prefere atendimento por telefone",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 70,
    prazoEmHoras: 11,
    score: {
      percentual: 34,
      nivel: "Baixa",
      motivo: "Parou de responder após o valor",
    },
    historico: [
      {
        quando: "13/03 17:38",
        mensagem:
          "Olá Isabela! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "14/03 09:14",
        mensagem:
          "Isabela, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
      {
        quando: "14/03 12:26",
        mensagem:
          "Ainda dá tempo de garantir o horário desta semana, Isabela. Quer que eu reserve?",
        regra: "Follow-up D+3",
      },
    ],
  },
  {
    id: 38,
    lead: "Márcio Bulhões",
    telefone: "(51) 96042-4525",
    clinica: "Unidade Moinhos",
    regra: "Lead novo do site",
    acao: "Notificar CRC: lead novo, ligar em até 5 min",
    tipo: "alerta-humano",
    responsavel: "Humano",
    situacao: "Pendente",
    status: "Pendente",
    minutosSemAcao: 95,
    prazoEmHoras: -2.0,
    score: {
      percentual: 20,
      nivel: "Baixa",
      motivo: "Interação muito recente",
    },
    historico: [],
  },
  {
    id: 39,
    lead: "Carolina Xavier",
    telefone: "(51) 91233-2158",
    clinica: "Unidade Zona Sul",
    regra: "Lead novo do Meta Ads",
    acao: "Notificar CRC: lead novo, ligar em até 5 min",
    tipo: "alerta-humano",
    responsavel: "Humano",
    situacao: "Pendente",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 0.5,
    score: {
      percentual: 20,
      nivel: "Baixa",
      motivo: "Interação muito recente",
    },
    historico: [],
  },
  {
    id: 40,
    lead: "Paulo Guedes",
    telefone: "(51) 95619-4968",
    clinica: "Unidade Centro",
    regra: "Pedido de horário",
    acao: "Sugerir três horários disponíveis",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 2,
    score: {
      percentual: 51,
      nivel: "Média",
      motivo: "Perguntou sobre formas de pagamento",
    },
    historico: [
      {
        quando: "09/03 10:12",
        mensagem:
          "Oi Paulo, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
      {
        quando: "10/03 14:33",
        mensagem:
          "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
      {
        quando: "11/03 09:47",
        mensagem:
          "Paulo, consigo encaixar você esta semana. Prefere manhã ou tarde?",
        regra: "Pedido de horário",
      },
    ],
  },
  {
    id: 41,
    lead: "Simone Wagner",
    telefone: "(51) 96966-6389",
    clinica: "Unidade Centro",
    regra: "Cliente antigo inativo",
    acao: "Convidar para avaliação de retorno",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 2,
    score: {
      percentual: 43,
      nivel: "Baixa",
      motivo: "Parou de responder após o valor",
    },
    historico: [
      {
        quando: "10/03 14:33",
        mensagem:
          "Olá Simone! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "11/03 09:47",
        mensagem:
          "Simone, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
      {
        quando: "11/03 16:20",
        mensagem:
          "Ainda dá tempo de garantir o horário desta semana, Simone. Quer que eu reserve?",
        regra: "Follow-up D+3",
      },
    ],
  },
  {
    id: 42,
    lead: "Alexandre Reis",
    telefone: "(51) 97252-2374",
    clinica: "Unidade Centro",
    regra: "Fora da área de atendimento",
    acao: "Encerrar conversa com mensagem cordial",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Desqualificado",
    status: "Rejeitado",
    minutosSemAcao: 500,
    prazoEmHoras: 72,
    score: {
      percentual: 8,
      nivel: "Baixa",
      motivo: "Buscava apenas tabela de preços",
    },
    historico: [
      {
        quando: "11/03 09:47",
        mensagem:
          "Olá Alexandre! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?",
        regra: "Verificação de localização",
      },
    ],
  },
  {
    id: 43,
    lead: "Fernanda Antunes",
    telefone: "(51) 93357-7545",
    clinica: "Unidade Zona Sul",
    regra: "Agendamento não confirmado",
    acao: "Confirmar consulta e orientar chegada",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 90,
    prazoEmHoras: 26,
    score: {
      percentual: 87,
      nivel: "Alta",
      motivo: "Consulta marcada e orçamento aceito",
    },
    historico: [
      {
        quando: "11/03 16:20",
        mensagem:
          "Fernanda, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "12/03 08:55",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 44,
    lead: "Douglas Meireles",
    telefone: "(51) 99670-3543",
    clinica: "Unidade Zona Sul",
    regra: "Cliente antigo inativo",
    acao: "Convidar para avaliação de retorno",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 190,
    prazoEmHoras: -3,
    score: {
      percentual: 52,
      nivel: "Média",
      motivo: "Leu a mensagem e não retornou",
    },
    historico: [
      {
        quando: "12/03 08:55",
        mensagem:
          "Olá Douglas! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "12/03 15:40",
        mensagem:
          "Douglas, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
      {
        quando: "13/03 11:05",
        mensagem:
          "Ainda dá tempo de garantir o horário desta semana, Douglas. Quer que eu reserve?",
        regra: "Follow-up D+3",
      },
    ],
  },
  {
    id: 45,
    lead: "Elisa Konrad",
    telefone: "(51) 99404-8032",
    clinica: "Unidade Zona Sul",
    regra: "Dúvida sobre o procedimento",
    acao: "Enviar explicação do protocolo",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 130,
    prazoEmHoras: 24,
    score: {
      percentual: 54,
      nivel: "Média",
      motivo: "Demonstrou interesse, mas travou no valor",
    },
    historico: [
      {
        quando: "12/03 15:40",
        mensagem:
          "Oi Elisa, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
      {
        quando: "13/03 11:05",
        mensagem:
          "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
      {
        quando: "13/03 17:38",
        mensagem:
          "Elisa, consigo encaixar você esta semana. Prefere manhã ou tarde?",
        regra: "Pedido de horário",
      },
    ],
  },
  {
    id: 46,
    lead: "Rogério Pacheco",
    telefone: "(51) 96909-2718",
    clinica: "Unidade Centro",
    regra: "Sem resposta há 48h",
    acao: "Enviar mensagem de reativação no WhatsApp",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 350,
    prazoEmHoras: 55,
    score: {
      percentual: 47,
      nivel: "Média",
      motivo: "Abriu o orçamento duas vezes, mas não respondeu",
    },
    historico: [
      {
        quando: "13/03 11:05",
        mensagem:
          "Olá Rogério! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "13/03 17:38",
        mensagem:
          "Rogério, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
    ],
  },
  {
    id: 47,
    lead: "Amanda Cerutti",
    telefone: "(51) 92148-9240",
    clinica: "Unidade Zona Sul",
    regra: "Lead novo do Meta Ads",
    acao: "Notificar CRC: lead novo, ligar em até 5 min",
    tipo: "alerta-humano",
    responsavel: "Humano",
    situacao: "Pendente",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 0.5,
    score: {
      percentual: 20,
      nivel: "Baixa",
      motivo: "Interação muito recente",
    },
    historico: [],
  },
  {
    id: 48,
    lead: "Sérgio Balbinot",
    telefone: "(51) 94362-4780",
    clinica: "Unidade Zona Sul",
    regra: "Lead novo do Meta Ads",
    acao: "Notificar CRC: lead novo, ligar em até 5 min",
    tipo: "alerta-humano",
    responsavel: "Humano",
    situacao: "Pendente",
    status: "Pendente",
    minutosSemAcao: 12,
    prazoEmHoras: 0.5,
    score: {
      percentual: 20,
      nivel: "Baixa",
      motivo: "Interação muito recente",
    },
    historico: [],
  },
  {
    id: 49,
    lead: "Michele Dornelles",
    telefone: "(51) 94248-2269",
    clinica: "Unidade Zona Sul",
    regra: "Confirmação de consulta · D-1",
    acao: "Pedir confirmação da consulta de amanhã",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 60,
    prazoEmHoras: 5,
    score: {
      percentual: 80,
      nivel: "Alta",
      motivo: "Consulta marcada e orçamento aceito",
    },
    historico: [
      {
        quando: "14/03 12:26",
        mensagem:
          "Michele, sua avaliação ficou marcada. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "09/03 10:12",
        mensagem:
          "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 50,
    lead: "Fábio Guerreiro",
    telefone: "(51) 98959-5403",
    clinica: "Unidade Moinhos",
    regra: "Follow-up D+3",
    acao: "Perguntar se prefere atendimento por telefone",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 45,
    prazoEmHoras: 8,
    score: {
      percentual: 52,
      nivel: "Média",
      motivo: "Parou de responder após o valor",
    },
    historico: [
      {
        quando: "09/03 10:12",
        mensagem:
          "Olá Fábio! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "10/03 14:33",
        mensagem:
          "Fábio, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
      {
        quando: "11/03 09:47",
        mensagem:
          "Ainda dá tempo de garantir o horário desta semana, Fábio. Quer que eu reserve?",
        regra: "Follow-up D+3",
      },
    ],
  },
  {
    id: 51,
    lead: "Rafaela Ost",
    telefone: "(51) 98640-2941",
    clinica: "Unidade Moinhos",
    regra: "Pedido de horário",
    acao: "Sugerir três horários disponíveis",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 45,
    prazoEmHoras: 8,
    score: {
      percentual: 72,
      nivel: "Alta",
      motivo: "Pediu horário para esta semana",
    },
    historico: [
      {
        quando: "10/03 14:33",
        mensagem:
          "Oi Rafaela, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do site",
      },
      {
        quando: "11/03 09:47",
        mensagem:
          "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
      {
        quando: "11/03 16:20",
        mensagem:
          "Rafaela, consigo encaixar você esta semana. Prefere manhã ou tarde?",
        regra: "Pedido de horário",
      },
    ],
  },
  {
    id: 52,
    lead: "Júlio Menegat",
    telefone: "(51) 98363-5401",
    clinica: "Unidade Moinhos",
    regra: "Sem resposta há 48h",
    acao: "Enviar mensagem de reativação no WhatsApp",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 130,
    prazoEmHoras: 24,
    score: {
      percentual: 34,
      nivel: "Baixa",
      motivo: "Parou de responder após o valor",
    },
    historico: [
      {
        quando: "11/03 09:47",
        mensagem:
          "Olá Júlio! Passando para saber se ficou alguma dúvida sobre o que conversamos.",
        regra: "Retomada de conversa",
      },
      {
        quando: "11/03 16:20",
        mensagem:
          "Júlio, separei alguns resultados de pacientes com perfil parecido com o seu.",
        regra: "Follow-up D+2",
      },
    ],
  },
];

/** Situações consideradas "ativas" no filtro da fila. */
export const situacoesAtivas: SituacaoLead[] = [
  "Pendente",
  "Em Atendimento",
  "Aguardando Resposta",
];
