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

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const especialidadesIniciais: Especialidade[] = [
  {
    id: 1,
    nome: "Harmonização facial",
    duracaoMinutos: 50,
    comoAbordar:
      "O procedimento mais pedido da carteira. Não passar valor fechado antes da avaliação: o plano depende do rosto de cada pessoa. Reforçar resultado natural e acompanhamento por 90 dias.",
    ativa: true,
  },
  {
    id: 2,
    nome: "Preenchimento labial",
    duracaoMinutos: 40,
    comoAbordar:
      "Muita gente chega com medo de exagero. Falar em volume proporcional ao rosto, nunca comparar com pessoa pública e oferecer antes e depois de perfil parecido.",
    ativa: true,
  },
  {
    id: 3,
    nome: "Toxina botulínica",
    duracaoMinutos: 30,
    comoAbordar:
      "Procedimento de entrada, decisão rápida. Resposta objetiva, explicar que o efeito aparece em cerca de 7 dias e dura de 4 a 6 meses, e encaixar na agenda da semana.",
    ativa: true,
  },
  {
    id: 4,
    nome: "Bioestimulador de colágeno",
    duracaoMinutos: 45,
    comoAbordar:
      "Avaliação cobrada: avisar o valor com naturalidade e explicar que ele é abatido do tratamento. Deixar claro que o resultado é gradual, ao longo de meses, para não criar expectativa de efeito imediato.",
    ativa: true,
  },
  {
    id: 5,
    nome: "Limpeza de pele",
    duracaoMinutos: 30,
    comoAbordar:
      "Porta de entrada de quem ainda não conhece a clínica. Atendimento leve e rápido, com foco em marcar a primeira sessão sem empurrar procedimento injetável na mesma conversa.",
    ativa: true,
  },
  {
    id: 6,
    nome: "Drenagem linfática",
    duracaoMinutos: 20,
    comoAbordar:
      "Inativa no catálogo e sem nenhuma clínica oferecendo no momento. A IA não deve oferecer nem agendar: se o lead perguntar, avisar a equipe.",
    ativa: false,
  },
];

/** Busca pelo id, para as telas que só guardam a referência. */
export function especialidadePorId(id: number) {
  return especialidadesIniciais.find((e) => e.id === id);
}
