/**
 * O catálogo de procedimentos da agência. Guarda o que é do procedimento em
 * si — nome, quanto tempo leva, como falar dele — e nada do que muda de
 * cliente para cliente.
 *
 * O preço da avaliação **não** mora aqui: ele é de cada clínica, e vive em
 * `clinicas.ts`, dentro de `procedimentos`. Enquanto morou nos dois lugares,
 * o catálogo dizia que bioestimulador custava R$ 150 enquanto cinco clínicas
 * cobravam de R$ 150 a R$ 300 — e não havia como saber qual das duas respostas
 * dar ao lead.
 */
export type Especialidade = {
  id: number;
  nome: string;
  /** Duração da consulta de avaliação, em minutos. */
  duracaoMinutos: number;
  /** Orientação de tom que a IA segue ao falar dessa especialidade. */
  comoAbordar: string;
  ativa: boolean;
};

// Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
// Quando esta tela passar a ler o banco, é este array que some.
export const especialidadesIniciais: Especialidade[] = [];

/** Busca pelo id, para as telas que só guardam a referência. */
export function especialidadePorId(id: number) {
  return especialidadesIniciais.find((e) => e.id === id);
}
