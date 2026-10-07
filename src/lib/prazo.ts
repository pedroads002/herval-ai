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
  return horas < 0
    ? `Venceu há ${emTexto(horas)}`
    : `Vence em ${emTexto(horas)}`;
}

/**
 * O prazo como data e hora, por exemplo "qui, 08/10 14:30".
 *
 * Toda tarefa chega à tela com `prazoEm`, venha ele da data marcada por quem
 * criou ou da contagem em minutos do n8n. A contagem continua existindo ao lado
 * (`descricaoPrazo`), porque "vence em 20 min" é a informação útil para uma
 * trava, e "quinta às 14:30" é a informação útil para um retorno marcado.
 *
 * Sempre no fuso de Brasília: a operação é toda no Brasil, e deixar o fuso do
 * navegador decidir faria a mesma tarefa mostrar horas diferentes para o CRC e
 * para quem olha de fora.
 */
export function dataEHoraDoPrazo(iso: string) {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return "Sem prazo";

  const dia = quando.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  const hora = quando.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dia} ${hora}`;
}
