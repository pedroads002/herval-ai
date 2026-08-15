import type { EtapaFunil } from "@/data/leads";
import { mudancasDoLead, type MudancaDeEtapa } from "@/data/historicoEtapas";

/**
 * Regra oficial de primeiro contato: é a entrada do lead na etapa "Em Contato".
 *
 * A alternativa era a primeira mensagem do histórico da IA, e ela foi
 * descartada de propósito. A régua do projeto diz que o primeiro contato de
 * lead novo nunca é da IA — então aquela mensagem mede a segunda ação, não a
 * primeira. Medir pela etapa cobra exatamente o que a operação promete.
 *
 * O custo é que depende de o CRC mover o card. Isso é assumido: lead com
 * ligação feita e card parado aparece como demora, em vez de sumir da conta.
 *
 * Esta é a definição única de tempo de resposta do sistema. Qualquer tela que
 * mostre esse número lê daqui, e não recalcula do seu jeito.
 */
export const ETAPA_PRIMEIRO_CONTATO: EtapaFunil = "Em Contato";

/** A chegada do lead na base: a primeira linha do histórico dele. */
export function chegadaDoLead(
  historico: MudancaDeEtapa[],
  leadId: number,
): MudancaDeEtapa | null {
  return mudancasDoLead(historico, leadId)[0] ?? null;
}

/** A mudança que marcou o primeiro contato. Nulo em quem nunca foi atendido. */
export function primeiroContato(
  historico: MudancaDeEtapa[],
  leadId: number,
): MudancaDeEtapa | null {
  return (
    mudancasDoLead(historico, leadId).find(
      (m) => m.etapaNova === ETAPA_PRIMEIRO_CONTATO,
    ) ?? null
  );
}

/**
 * Quantos minutos o lead esperou até alguém falar com ele. Nulo quando ainda
 * não houve contato — e nulo não é zero: quem ainda espera não pode entrar
 * numa média como se tivesse sido atendido na hora.
 */
export function minutosAteOPrimeiroContato(
  historico: MudancaDeEtapa[],
  leadId: number,
): number | null {
  const chegada = chegadaDoLead(historico, leadId);
  const contato = primeiroContato(historico, leadId);
  if (!chegada || !contato) return null;
  return chegada.minutosAtras - contato.minutosAtras;
}

export type TempoDeResposta = {
  /** Média em minutos dos leads que já foram contatados. */
  media: number | null;
  /** Mediana: resiste a um caso perdido que puxaria a média sozinho. */
  mediana: number | null;
  atendidos: number;
  aguardando: number;
};

export function tempoDeResposta(
  historico: MudancaDeEtapa[],
  leadIds: number[],
): TempoDeResposta {
  const tempos: number[] = [];
  let aguardando = 0;

  for (const id of leadIds) {
    const minutos = minutosAteOPrimeiroContato(historico, id);
    if (minutos === null) aguardando += 1;
    else tempos.push(minutos);
  }

  if (tempos.length === 0) {
    return { media: null, mediana: null, atendidos: 0, aguardando };
  }

  const ordenados = [...tempos].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);

  return {
    media: Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length),
    mediana:
      ordenados.length % 2 === 0
        ? Math.round((ordenados[meio - 1] + ordenados[meio]) / 2)
        : ordenados[meio],
    atendidos: tempos.length,
    aguardando,
  };
}
