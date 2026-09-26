import { etapasFunil, type EtapaFunil } from "@/data/leads";

/**
 * Quem executou a mudança de etapa.
 *
 * "IA" é a IA agindo no lugar da pessoa; "Automática" é o sistema reagindo a
 * um fato (a consulta virou falta, então o lead volta para Reagendamento);
 * "Humano" é alguém do CRC movendo o card na mão.
 *
 * O nome só existe em "Humano", e vem do usuário autenticado — não há cadastro
 * de agente à parte, para não criar uma segunda identidade concorrendo com o
 * login. Fica nulo no histórico antigo, quando ainda não havia login.
 */
export type TipoAgente = "IA" | "Automática" | "Humano";

export const tiposDeAgente: TipoAgente[] = ["IA", "Automática", "Humano"];

export type Agente = {
  tipo: TipoAgente;
  /** Nome do usuário logado. Só em ações humanas, e só a partir de agora. */
  nome?: string;
};

export const AGENTE_IA: Agente = { tipo: "IA" };
export const AGENTE_AUTOMATICO: Agente = { tipo: "Automática" };

/**
 * Uma mudança de etapa. É o registro que faltava: até aqui a base guardava
 * apenas a etapa em que o lead está agora, e por isso não havia como responder
 * "quanto tempo levou até alguém falar com este lead".
 *
 * `minutosAtras` conta para trás a partir de agora, na convenção de
 * `lib/tempo.ts`. Em minutos, e não em dias, porque é isso que a métrica de
 * tempo de resposta exige.
 */
export type MudancaDeEtapa = {
  id: number;
  leadId: number;
  /** Nulo na primeira linha: é a entrada do lead na base. */
  etapaAnterior: EtapaFunil | null;
  etapaNova: EtapaFunil;
  minutosAtras: number;
  agente: Agente;
};

/**
 * Formato compacto, como em `leadsHistoricos` e `agendamentos`, com uma linha
 * por lead em vez de uma por mudança:
 *
 *   [leadId, etapa, minutosAtras, agente, etapa, minutosAtras, agente, ...]
 *
 * As etapas vêm pela posição em `etapasFunil` e o agente pela posição em
 * `tiposDeAgente`. `etapaAnterior` e `id` não são guardados: a etapa anterior é
 * sempre a da trinca de trás (a primeira não tem), e o id é a ordem de leitura.
 * Guardar os dois seria repetir, em treze mil linhas, o que já dá para deduzir.
 *
 * Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
 * Quando esta tela passar a ler o banco, é este array que some.
 */
type LinhaMudanca = number[];

const registros: LinhaMudanca[] = [];

export const historicoDeEtapasInicial: MudancaDeEtapa[] = registros.flatMap(
  ([leadId, ...trincas]) => {
    let anterior: EtapaFunil | null = null;

    return Array.from({ length: trincas.length / 3 }, (_, i) => {
      const [etapa, minutosAtras, agente] = trincas.slice(i * 3, i * 3 + 3);
      const mudanca: MudancaDeEtapa = {
        id: 0,
        leadId,
        etapaAnterior: anterior,
        etapaNova: etapasFunil[etapa],
        minutosAtras,
        agente: { tipo: tiposDeAgente[agente] },
      };
      anterior = mudanca.etapaNova;
      return mudanca;
    });
  },
).map((mudanca, indice) => ({ ...mudanca, id: indice + 1 }));

/**
 * As mudanças agrupadas por lead, já em ordem. Ler o histórico inteiro para
 * cada lead custaria caro numa base deste tamanho, e toda tela que mede tempo
 * de resposta precisa disso lead a lead.
 */
export function indexarPorLead(
  historico: MudancaDeEtapa[],
): Map<number, MudancaDeEtapa[]> {
  const indice = new Map<number, MudancaDeEtapa[]>();

  for (const mudanca of historico) {
    const lista = indice.get(mudanca.leadId);
    if (lista) lista.push(mudanca);
    else indice.set(mudanca.leadId, [mudanca]);
  }

  for (const lista of indice.values()) {
    lista.sort((a, b) => b.minutosAtras - a.minutosAtras || a.id - b.id);
  }
  return indice;
}

/** Todas as mudanças de um lead, da mais antiga para a mais recente. */
export function mudancasDoLead(
  historico: MudancaDeEtapa[],
  leadId: number,
): MudancaDeEtapa[] {
  return historico
    .filter((m) => m.leadId === leadId)
    .sort((a, b) => b.minutosAtras - a.minutosAtras || a.id - b.id);
}

/** Quando o lead entrou numa etapa pela primeira vez. Nulo se nunca entrou. */
export function entradaNaEtapa(
  historico: MudancaDeEtapa[],
  leadId: number,
  etapa: EtapaFunil,
): MudancaDeEtapa | null {
  const minhas = mudancasDoLead(historico, leadId).filter(
    (m) => m.etapaNova === etapa,
  );
  return minhas[0] ?? null;
}
