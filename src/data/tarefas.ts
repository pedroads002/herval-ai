export type StatusTarefa = "Pendente" | "Aprovado" | "Rejeitado";

export type Tarefa = {
  id: number;
  lead: string;
  regra: string;
  acao: string;
  status: StatusTarefa;
};

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const tarefasIniciais: Tarefa[] = [
  {
    id: 1,
    lead: "Mariana Souza",
    regra: "Sem resposta há 48h",
    acao: "Enviar mensagem de reativação no WhatsApp",
    status: "Pendente",
  },
  {
    id: 2,
    lead: "Carlos Menezes",
    regra: "Orçamento enviado sem retorno",
    acao: "Oferecer parcelamento em 12x",
    status: "Pendente",
  },
  {
    id: 3,
    lead: "Juliana Prado",
    regra: "Lead novo do Meta Ads",
    acao: "Primeiro contato em até 5 minutos",
    status: "Aprovado",
  },
  {
    id: 4,
    lead: "Rafael Lima",
    regra: "Objeção de preço detectada",
    acao: "Responder com quebra de objeção padrão",
    status: "Pendente",
  },
  {
    id: 5,
    lead: "Ana Beatriz Rocha",
    regra: "Agendamento não confirmado",
    acao: "Confirmar consulta de amanhã às 14h",
    status: "Rejeitado",
  },
  {
    id: 6,
    lead: "Diego Ferraz",
    regra: "Cliente antigo inativo há 6 meses",
    acao: "Convidar para avaliação de retorno",
    status: "Pendente",
  },
];
