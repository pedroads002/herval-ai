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

export const modoInicial: ModoAtendimento = "Todo lead";

/**
 * A ficha da clínica — história, diferenciais, ticket médio, formas de
 * pagamento, público-alvo, endereço e horário — não mora mais aqui: virou
 * campo de cada cliente em `clinicas.ts`.
 *
 * Enquanto morava neste arquivo, existia uma ficha só para doze clientes: a
 * história da Corpus Harmonia e a da Dra. Helena Braga eram a mesma frase.
 * O que sobrou aqui é o que de fato é configuração da IA, e não do cliente.
 */
