const numero = new Intl.NumberFormat("pt-BR");

// Não existe formatador de moeda aqui, de propósito, e isto não é descuido: o
// sistema não guarda preço fechado de nada nem de ninguém. Se você veio procurar
// `formatarMoeda`, ela foi removida junto com todos os campos de dinheiro do
// painel — e não deve voltar. A única forma de valor que existe é a faixa
// aproximada logo abaixo, que não tem como imprimir um número só.

export function formatarNumero(valor: number) {
  return numero.format(valor);
}

/**
 * A faixa de valor médio aproximado de um procedimento.
 *
 * Recebe dois limites e só sabe escrever os dois. É por isso que ela existe em
 * vez de um `formatarMoeda` genérico: com um formatador de número solitário no
 * código, a primeira tela apressada volta a imprimir preço fechado. Aqui não
 * tem como — faltaria metade do argumento.
 *
 * O "em média de" é parte do dado, não enfeite: sem ele a frase vira cotação, e
 * cotação fora da consulta de avaliação é exatamente o que não pode existir.
 */
export function formatarFaixaDeValorMedio(de: number, ate: number) {
  return `em média de R$ ${numero.format(de)} a R$ ${numero.format(ate)}`;
}

/** 40 vira "40 min"; 50 vira "50 min"; 90 vira "1h30". */
export function formatarDuracao(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0
    ? `${horas}h`
    : `${horas}h${String(resto).padStart(2, "0")}`;
}

/** Percentual de uma etapa em relação a outra, arredondado. */
export function percentual(parte: number, total: number) {
  if (total === 0) return 0;
  return Math.round((parte / total) * 100);
}
