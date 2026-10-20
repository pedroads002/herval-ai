/**
 * Tipos e constantes dos textos de follow-up (régua de automação).
 *
 * Fica fora de `lib/dados/followUp.ts` de propósito: aquele arquivo importa
 * `criarClienteServidor`, que depende de `next/headers` e só roda no
 * servidor. `GerenciadorFollowUp.tsx` é `"use client"` e precisa destes
 * tipos — se importasse de `lib/dados`, o bundler levaria o cliente do
 * Supabase junto para o navegador. Mesma separação de `data/objecoes.ts`
 * (que `GerenciadorObjecoes.tsx` importa) e `lib/dados/objecoes.ts` (que só
 * o servidor importa).
 */
export type EtapaDeFollowUp = "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";

export const ETAPAS_DE_FOLLOW_UP: EtapaDeFollowUp[] = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
];

export type MensagemFollowUp = {
  id: number;
  etapa: EtapaDeFollowUp;
  ordem: number;
  texto: string;
  delaySegundos: number;
};
