export type GrupoPrazo = "Atrasada" | "Hoje" | "Amanhã" | "Futura";

/** Ordem em que os grupos aparecem na fila: o mais urgente primeiro. */
export const gruposPrazo: GrupoPrazo[] = [
  "Atrasada",
  "Hoje",
  "Amanhã",
  "Futura",
];

/** Converte as horas restantes em um grupo de urgência. */
export function grupoDoPrazo(horas: number): GrupoPrazo {
  if (horas < 0) return "Atrasada";
  if (horas <= 12) return "Hoje";
  if (horas <= 36) return "Amanhã";
  return "Futura";
}

function emTexto(horas: number) {
  const absoluto = Math.abs(horas);
  if (absoluto < 1) return `${Math.round(absoluto * 60)} min`;
  if (absoluto < 48) return `${Math.round(absoluto)}h`;
  return `${Math.round(absoluto / 24)} dias`;
}

/** Texto curto mostrado na linha, por exemplo "Venceu há 3h". */
export function descricaoPrazo(horas: number) {
  return horas < 0 ? `Venceu há ${emTexto(horas)}` : `Vence em ${emTexto(horas)}`;
}
