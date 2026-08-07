/** Como a IA atua na base de leads. */
export type ModoAtendimento =
  | "Pausada"
  | "Todo lead"
  | "Só marketing"
  | "Só humano";

export const modosAtendimento: {
  modo: ModoAtendimento;
  descricao: string;
}[] = [
  { modo: "Pausada", descricao: "A IA não envia nenhuma mensagem." },
  { modo: "Todo lead", descricao: "A IA atua em todos os leads da base." },
  {
    modo: "Só marketing",
    descricao: "A IA atua apenas em leads vindos de campanhas.",
  },
  {
    modo: "Só humano",
    descricao: "A IA apenas sugere; quem envia é a equipe.",
  },
];

export type Estrategia = {
  historia: string;
  diferenciais: string;
  ticketMedio: string;
  formasPagamento: string;
  publicoAlvo: string;
  endereco: string;
  horarioFuncionamento: string;
};

// Valores de exemplo. Ainda não vêm de banco nem de API.
export const estrategiaInicial: Estrategia = {
  historia:
    "Clínica fundada em 2015, começou como consultório único e hoje atende mais de 300 pacientes por mês em duas unidades.",
  diferenciais:
    "Equipe médica própria, protocolos exclusivos, atendimento humanizado e acompanhamento pós-procedimento por 90 dias.",
  ticketMedio: "R$ 3.500,00",
  formasPagamento: "Pix, cartão em até 12x, boleto e financiamento próprio.",
  publicoAlvo:
    "Mulheres e homens de 28 a 55 anos, classe A/B, que buscam resultados naturais e segurança.",
  endereco:
    "Rua Mostardeiro, 322 · Sala 704 · Moinhos de Vento · Porto Alegre/RS",
  horarioFuncionamento:
    "Segunda a sexta, das 9h às 19h. Sábado, das 9h às 13h.",
};

export const modoInicial: ModoAtendimento = "Todo lead";
