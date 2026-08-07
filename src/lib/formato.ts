const numero = new Intl.NumberFormat("pt-BR");

export function formatarNumero(valor: number) {
  return numero.format(valor);
}

/** Percentual de uma etapa em relação a outra, arredondado. */
export function percentual(parte: number, total: number) {
  if (total === 0) return 0;
  return Math.round((parte / total) * 100);
}
