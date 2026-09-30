/**
 * Clientes da agência. Cada cliente aparece como uma linha nos relatórios.
 *
 * O nome "clínica" é o que a equipe usa no dia a dia, mas o cadastro é do
 * cliente: ele pode ter uma unidade, dezenas, ou nenhuma ainda (quem está
 * começando e atende em espaço alugado ou a domicílio).
 *
 * A ficha completa mora aqui, e não numa tela de configuração à parte, porque
 * ela é de cada cliente. Enquanto história, diferenciais, formas de pagamento
 * e público-alvo viveram em `estrategia.ts`, existia uma ficha só para doze
 * clientes — o que só funcionava enquanto ninguém olhava dois deles lado a
 * lado. `estrategia.ts` ficou com o que é de fato configuração da IA.
 */

/** Classe econômica predominante do público da clínica. */
export type ClasseEconomica = "A" | "B" | "C" | "D";

export const classesEconomicas: ClasseEconomica[] = ["A", "B", "C", "D"];

export type FormaPagamento =
  | "Pix"
  | "Dinheiro"
  | "Cartão de crédito"
  | "Cartão de débito"
  | "Boleto"
  | "Financiamento próprio";

export const formasDePagamento: FormaPagamento[] = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Financiamento próprio",
];

/**
 * Convênio aceito e o que ele cobre. Estética quase nunca é coberta, então a
 * lista vazia é o caso comum — e é uma informação, não uma lacuna: serve para
 * o CRC responder na hora que o lead pergunta.
 */
export type Convenio = {
  nome: string;
  /** Ids da tela de Especialidades cobertos por este convênio. */
  especialidadeIds: number[];
};

/**
 * O que a clínica oferece e quanto cobra pela consulta de avaliação.
 *
 * Estar aqui já quer dizer que a clínica oferece o procedimento. Nada além
 * disso: o sistema não guarda nem exibe valor de nada nem de ninguém.
 */
export type ProcedimentoDaClinica = {
  especialidadeId: number;
};

export type Clinica = {
  id: number;
  nome: string;
  cidade: string;
  /** Quantas unidades físicas. Zero é válido: cliente sem clínica própria. */
  unidades: number;
  /** Cliente pausado continua no cadastro, mas fora da operação. */
  ativa: boolean;
  endereco: string;
  horarioFuncionamento: string;

  // Estratégia e diferenciais
  historia: string;
  diferenciais: string;
  /** Carro-chefe da clínica. Id da tela de Especialidades. */
  tratamentoFocoId: number;
  procedimentos: ProcedimentoDaClinica[];

  // Comercial e condições
  parcelasMaximas: number;
  formasPagamento: FormaPagamento[];
  convenios: Convenio[];

  // Público-alvo
  classes: ClasseEconomica[];
  faixaEtaria: { de: number; ate: number };
  principaisDores: string[];
};

// Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
// Quando esta tela passar a ler o banco, é este array que some.
export const clinicasIniciais: Clinica[] = [];

export function clinicaPorId(id: number) {
  return clinicasIniciais.find((c) => c.id === id);
}

/** Nome da clínica, com um rótulo seguro caso o id não exista mais. */
export function nomeDaClinica(id: number) {
  return clinicaPorId(id)?.nome ?? "Clínica removida";
}

/** O procedimento na clínica. Nulo quando ela não oferece. */
export function procedimentoDaClinica(
  clinica: Clinica,
  especialidadeId: number,
) {
  return (
    clinica.procedimentos.find((p) => p.especialidadeId === especialidadeId) ??
    null
  );
}

/** Se a clínica oferece o procedimento. Estar na lista já é a resposta. */
export function oferece(clinica: Clinica, especialidadeId: number) {
  return procedimentoDaClinica(clinica, especialidadeId) !== null;
}

/** Quais clínicas oferecem o procedimento. */
export function clinicasQueOferecem(especialidadeId: number) {
  return clinicasIniciais.filter((c) => oferece(c, especialidadeId));
}

/**
 * Quais convênios cobrem o procedimento nesta clínica. Devolve lista vazia
 * quando nenhum cobre — que é o caso comum em estética, e é uma resposta.
 */
export function conveniosQueCobrem(clinica: Clinica, especialidadeId: number) {
  return clinica.convenios.filter((c) =>
    c.especialidadeIds.includes(especialidadeId),
  );
}
