/**
 * Cada template corresponde a uma regra da Régua de Automação, pelo id.
 * O gatilho, a espera e quem executa não são repetidos aqui: vêm de lá, para
 * as duas telas nunca discordarem.
 */
export type Template = {
  id: number;
  fluxo: string;
  /** Id da regra em src/data/reguaAutomacao.ts */
  regraId: number;
  texto: string;
  usos: number;
};

/** Ordem dos grupos na tela, do mais frequente ao mais raro. */
export const gruposTemplate = [
  "Recuperação",
  "Follow-up",
  "Confirmação de consulta",
  "Pós-consulta",
] as const;

export type GrupoTemplate = (typeof gruposTemplate)[number];

export const grupoDoTemplate: Record<number, GrupoTemplate> = {
  1: "Recuperação",
  2: "Follow-up",
  3: "Follow-up",
  4: "Follow-up",
  5: "Follow-up",
  6: "Follow-up",
  7: "Confirmação de consulta",
  8: "Confirmação de consulta",
  9: "Confirmação de consulta",
  10: "Pós-consulta",
};

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const templatesIniciais: Template[] = [
  {
    id: 1,
    fluxo: "Recuperação",
    regraId: 3,
    texto:
      "Oi, {{nome}}! Aqui é da {{clinica}}. Vi que a gente conversou sobre {{especialidade}} e a conversa acabou parando. Ainda faz sentido pra você? Se quiser, retomo de onde paramos.",
    usos: 412,
  },
  {
    id: 2,
    fluxo: "Follow-up D+1",
    regraId: 8,
    texto:
      "{{nome}}, bom dia! Consegui separar dois horários para sua avaliação de {{especialidade}}: {{data}} às {{horario}} ou no mesmo dia à tarde. Algum deles funciona?",
    usos: 356,
  },
  {
    id: 3,
    fluxo: "Follow-up D+2",
    regraId: 9,
    texto:
      "Oi, {{nome}}! Separei alguns antes e depois de pacientes com perfil parecido com o seu em {{especialidade}}. Todos com resultado natural, que é o nosso jeito de trabalhar. Posso te enviar?",
    usos: 241,
  },
  {
    id: 4,
    fluxo: "Follow-up D+3",
    regraId: 10,
    texto:
      "{{nome}}, prefere que a gente converse por telefone? Às vezes é mais fácil tirar dúvida de {{especialidade}} falando. Me diz um horário bom e a {{clinica}} te liga.",
    usos: 178,
  },
  {
    id: 5,
    fluxo: "Follow-up D+5",
    regraId: 11,
    texto:
      "Oi, {{nome}}! Lembrando que o valor de {{especialidade}} inclui acompanhamento por 90 dias e retoques, e pode ser parcelado em até 12x. Quer que eu simule pra você?",
    usos: 96,
  },
  {
    id: 6,
    fluxo: "Follow-up D+7",
    regraId: 12,
    texto:
      "{{nome}}, vou parar de te escrever para não incomodar. A porta da {{clinica}} fica aberta: quando quiser retomar {{especialidade}}, é só chamar por aqui. Um abraço!",
    usos: 84,
  },
  {
    id: 7,
    fluxo: "Confirmação · D-2",
    regraId: 13,
    texto:
      "Oi, {{nome}}! Sua avaliação de {{especialidade}} está marcada para {{data}} às {{horario}}, com {{profissional}}. Endereço: {{endereco}}. Até lá!",
    usos: 523,
  },
  {
    id: 8,
    fluxo: "Confirmação · D-1",
    regraId: 14,
    texto:
      "{{nome}}, tudo certo para amanhã às {{horario}}? Responda SIM para confirmar. Chegue 10 minutos antes, em {{endereco}}, para o cadastro.",
    usos: 498,
  },
  {
    id: 9,
    fluxo: "Confirmação · no dia",
    regraId: 15,
    texto:
      "Oi, {{nome}}! Passando para lembrar da sua consulta hoje às {{horario}}, com {{profissional}}. Qualquer imprevisto, me avisa por aqui que a gente remarca.",
    usos: 461,
  },
  {
    id: 10,
    fluxo: "No-show",
    regraId: 16,
    texto:
      "Oi, {{nome}}! Senti sua falta na consulta de hoje às {{horario}}. Acontece! Quer que eu veja um novo horário para {{especialidade}} esta semana?",
    usos: 132,
  },
];
