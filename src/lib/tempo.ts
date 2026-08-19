/**
 * Tempo relativo, a convenção de data usada em toda a base: nada é gravado
 * como data fixa, só "há quanto tempo". É o que faz o exemplo não envelhecer.
 *
 * O funil e a agenda contam em dias, porque um dia de diferença não muda a
 * leitura deles. Já responder a um lead em 4 minutos ou em 4 horas é a
 * diferença entre atender e perder — então tudo que mede resposta conta em
 * minutos, e é este arquivo que liga as duas escalas.
 */

export const MINUTOS_POR_DIA = 24 * 60;

export function minutosDeDias(dias: number) {
  return Math.round(dias * MINUTOS_POR_DIA);
}

export function diasDeMinutos(minutos: number) {
  return Math.floor(minutos / MINUTOS_POR_DIA);
}

/** "há 12 min", "há 3h", "há 2 dias". Nunca mostra data, só distância. */
export function tempoRelativo(minutos: number) {
  const absoluto = Math.abs(Math.round(minutos));

  if (absoluto < 1) return "agora";
  if (absoluto < 60) return `há ${absoluto} min`;
  if (absoluto < MINUTOS_POR_DIA) return `há ${Math.round(absoluto / 60)}h`;

  const dias = Math.round(absoluto / MINUTOS_POR_DIA);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

/** A mesma distância, mas dita como duração: "4 min", "3h", "2 dias". */
export function duracao(minutos: number) {
  const absoluto = Math.abs(Math.round(minutos));

  if (absoluto < 60) return `${absoluto} min`;
  if (absoluto < MINUTOS_POR_DIA) return `${Math.round(absoluto / 60)}h`;

  const dias = Math.round(absoluto / MINUTOS_POR_DIA);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}
