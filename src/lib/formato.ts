const numero = new Intl.NumberFormat("pt-BR");

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarNumero(valor: number) {
  return numero.format(valor);
}

/** Valores em reais são guardados como número e formatados só na exibição. */
export function formatarMoeda(valor: number) {
  return moeda.format(valor);
}

/** 40 vira "40 min"; 50 vira "50 min"; 90 vira "1h30". */
export function formatarDuracao(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

/** Percentual de uma etapa em relação a outra, arredondado. */
export function percentual(parte: number, total: number) {
  if (total === 0) return 0;
  return Math.round((parte / total) * 100);
}
