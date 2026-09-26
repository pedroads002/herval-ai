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

export const grupoDoTemplate: Record<number, GrupoTemplate> = {};

// Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
// Quando esta tela passar a ler o banco, é este array que some.
export const templatesIniciais: Template[] = [];
