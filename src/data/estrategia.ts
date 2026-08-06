export type Estrategia = {
  historia: string;
  diferenciais: string;
  ticketMedio: string;
  formasPagamento: string;
  publicoAlvo: string;
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
};
