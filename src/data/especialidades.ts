/**
 * O catálogo de procedimentos da agência. Guarda o que é do procedimento em
 * si — nome, quanto tempo leva, como falar dele — e nada do que muda de
 * cliente para cliente.
 *
 * Preço não mora aqui nem em lugar nenhum: o sistema não guarda nem exibe
 * valor de nada nem de ninguém. Quanto custa é assunto da clínica, fora deste
 * painel.
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
