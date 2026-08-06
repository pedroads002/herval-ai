export type Objecao = {
  id: number;
  objecao: string;
  resposta: string;
  usos: number;
};

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const objecoesIniciais: Objecao[] = [
  {
    id: 1,
    objecao: "Está muito caro",
    resposta:
      "Entendo. Nosso valor inclui acompanhamento por 90 dias e retoques. Também parcelamos em até 12x sem comprometer o orçamento.",
    usos: 128,
  },
  {
    id: 2,
    objecao: "Vou pensar e retorno",
    resposta:
      "Claro. Posso reservar um horário provisório para esta semana? Se mudar de ideia, cancelamos sem custo.",
    usos: 94,
  },
  {
    id: 3,
    objecao: "Tenho medo do resultado ficar artificial",
    resposta:
      "Nosso protocolo prioriza resultado natural. Posso te enviar antes e depois de pacientes com o mesmo perfil que o seu.",
    usos: 71,
  },
  {
    id: 4,
    objecao: "Preciso falar com meu marido/esposa",
    resposta:
      "Faz total sentido. Quer que eu envie um resumo com valores e formas de pagamento para vocês avaliarem juntos?",
    usos: 63,
  },
  {
    id: 5,
    objecao: "Vi mais barato em outra clínica",
    resposta:
      "Vale comparar o que está incluso: produto usado, lote rastreado e equipe médica. Posso detalhar nosso pacote para você comparar.",
    usos: 47,
  },
  {
    id: 6,
    objecao: "Não tenho tempo agora",
    resposta:
      "O procedimento leva cerca de 40 minutos. Temos horários no início da manhã e após as 18h.",
    usos: 35,
  },
];
