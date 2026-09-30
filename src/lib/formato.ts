const numero = new Intl.NumberFormat("pt-BR");

// Não existe formatador de moeda aqui, de propósito: o sistema não guarda nem
// exibe valor de nada nem de ninguém. Se você veio procurar `formatarMoeda`,
// ela foi removida junto com todos os campos de dinheiro do painel.

export function formatarNumero(valor: number) {
  return numero.format(valor);
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
