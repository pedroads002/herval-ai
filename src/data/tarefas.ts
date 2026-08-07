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
    telefone: "(51) 99812-4477",
    clinica: "Unidade Moinhos",
    regra: "Sem resposta há 48h",
    acao: "Enviar mensagem de reativação no WhatsApp",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 95,
    score: {
      percentual: 62,
      nivel: "Média",
      motivo: "Abriu o orçamento duas vezes, mas não respondeu",
    },
    historico: [
      {
        quando: "12/03 09:14",
        mensagem:
          "Oi Mariana, tudo bem? Vi que você se interessou pela harmonização facial. Posso te explicar como funciona a avaliação?",
        regra: "Lead novo do Meta Ads",
      },
      {
        quando: "12/03 15:40",
        mensagem:
          "Passando o orçamento que combinamos. Qualquer dúvida é só chamar por aqui.",
        regra: "Solicitação de valores",
      },
      {
        quando: "14/03 10:02",
        mensagem:
          "Mariana, consegui reservar dois horários para esta semana. Prefere manhã ou tarde?",
        regra: "Sem resposta há 24h",
      },
    ],
  },
  {
    id: 2,
    lead: "Carlos Menezes",
    telefone: "(51) 99640-1180",
    clinica: "Unidade Centro",
    regra: "Orçamento enviado sem retorno",
    acao: "Oferecer parcelamento em 12x",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 38,
    score: {
      percentual: 74,
      nivel: "Alta",
      motivo: "Perguntou sobre formas de pagamento",
    },
    historico: [
      {
        quando: "13/03 11:20",
        mensagem:
          "Olá Carlos! Recebi seu contato sobre o procedimento corporal. Já fez alguma avaliação com a gente?",
        regra: "Lead novo do site",
      },
      {
        quando: "13/03 16:55",
        mensagem:
          "Enviei o orçamento completo no seu e-mail. O valor inclui o acompanhamento de 90 dias.",
        regra: "Solicitação de valores",
      },
    ],
  },
  {
    id: 3,
    lead: "Juliana Prado",
    telefone: "(51) 99277-3021",
    clinica: "Unidade Moinhos",
    regra: "Lead novo do Meta Ads",
    acao: "Notificar CRC: lead novo, ligar em até 5 min",
    // Primeiro contato de lead novo é sempre do time humano. A IA apenas avisa.
    tipo: "alerta-humano",
    responsavel: "Humano",
    situacao: "Pendente",
    status: "Pendente",
    minutosSemAcao: 4,
    score: {
      percentual: 20,
      nivel: "Baixa",
      motivo: "Interação muito recente",
    },
    historico: [],
  },
  {
    id: 4,
    lead: "Rafael Lima",
    telefone: "(51) 99155-8890",
    clinica: "Unidade Centro",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Em Atendimento",
    status: "Pendente",
    minutosSemAcao: 12,
    score: {
      percentual: 55,
      nivel: "Média",
      motivo: "Demonstrou interesse, mas travou no valor",
    },
    historico: [
      {
        quando: "14/03 08:31",
        mensagem:
          "Bom dia Rafael! Sobre o procedimento que conversamos, consigo te mostrar resultados de pacientes com perfil parecido.",
        regra: "Retomada de conversa",
      },
      {
        quando: "14/03 09:12",
        mensagem:
          "Entendo sua preocupação com o investimento. Posso te explicar o que está incluso no valor?",
        regra: "Objeção de preço detectada",
      },
    ],
  },
  {
    id: 5,
    lead: "Ana Beatriz Rocha",
    telefone: "(51) 99503-7742",
    clinica: "Unidade Zona Sul",
    regra: "Agendamento não confirmado",
    acao: "Confirmar consulta de amanhã às 14h",
    tipo: "acao-ia",
    responsavel: "Automática",
    situacao: "Agendado",
    status: "Pendente",
    minutosSemAcao: 140,
    score: {
      percentual: 88,
      nivel: "Alta",
      motivo: "Consulta marcada e orçamento aceito",
    },
    historico: [
      {
        quando: "11/03 14:05",
        mensagem:
          "Ana, sua avaliação ficou marcada para quinta às 14h na Unidade Zona Sul. Confirma para mim?",
        regra: "Agendamento criado",
      },
      {
        quando: "13/03 09:00",
        mensagem:
          "Lembrete: sua consulta é amanhã às 14h. Chegue com 10 minutos de antecedência.",
        regra: "Lembrete automático 24h",
      },
    ],
  },
  {
    id: 6,
    lead: "Diego Ferraz",
    telefone: "(51) 99388-2264",
    clinica: "Unidade Centro",
    regra: "Cliente antigo inativo há 6 meses",
    acao: "Convidar para avaliação de retorno",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Aguardando Resposta",
    status: "Pendente",
    minutosSemAcao: 260,
    score: {
      percentual: 41,
      nivel: "Baixa",
      motivo: "Sem interação nos últimos 6 meses",
    },
    historico: [
      {
        quando: "10/03 17:22",
        mensagem:
          "Oi Diego! Faz um tempo que não nos vemos. Quer agendar uma avaliação de manutenção?",
        regra: "Cliente antigo inativo",
      },
    ],
  },
  {
    id: 7,
    lead: "Patrícia Nogueira",
    telefone: "(51) 99722-9014",
    clinica: "Unidade Zona Sul",
    regra: "Lead novo do Meta Ads",
    acao: "Notificar CRC: lead novo, ligar em até 5 min",
    tipo: "alerta-humano",
    responsavel: "Humano",
    situacao: "Pendente",
    status: "Pendente",
    minutosSemAcao: 2,
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
    telefone: "(51) 99011-6653",
    clinica: "Unidade Moinhos",
    regra: "Fora da área de atendimento",
    acao: "Encerrar conversa com mensagem cordial",
    tipo: "acao-ia",
    responsavel: "IA",
    situacao: "Desqualificado",
    status: "Rejeitado",
    minutosSemAcao: 420,
    score: {
      percentual: 8,
      nivel: "Baixa",
      motivo: "Mora em outro estado",
    },
    historico: [
      {
        quando: "09/03 13:45",
        mensagem:
          "Olá Fernando! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?",
        regra: "Verificação de localização",
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
