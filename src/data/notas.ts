import { type Agente } from "@/data/historicoEtapas";

/**
 * As notas internas do CRC sobre o lead: o que ficou combinado, o que ele
 * falou fora da conversa, o motivo real por trás de uma objeção. Não é
 * mensagem — o lead nunca vê isso.
 *
 * É uma lista, e não um campo que se reescreve. Nota que se sobrescreve apaga
 * o que a pessoa anterior sabia, e o sistema inteiro foi construído para o
 * contrário disso: em toda parte dá para dizer quem fez o quê e quando.
 *
 * O autor reaproveita `Agente` de `historicoEtapas.ts` para não criar uma
 * segunda ideia de identidade no projeto. Nas notas antigas ele vem sem nome,
 * porque foram escritas antes de existir login — o mesmo que já acontece no
 * histórico de etapas.
 */
export type Nota = {
  id: number;
  leadId: number;
  autor: Agente;
  /** Há quantos minutos, na convenção de `lib/tempo.ts`. Nunca data fixa. */
  minutosAtras: number;
  texto: string;
};

/**
 * Formato compacto, como no resto da base: `[leadId, minutosAtras, texto]`.
 * O `id` sai da ordem de leitura e o autor é sempre humano sem nome — quando
 * a tela de atendimento existir, nota nova vai gravar o usuário logado.
 *
 * Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
 * Quando esta tela passar a ler o banco, é este array que some.
 */
type LinhaNota = [number, number, string];

const registros: LinhaNota[] = [];

export const notasIniciais: Nota[] = registros.map(
  ([leadId, minutosAtras, texto], indice) => ({
    id: indice + 1,
    leadId,
    autor: { tipo: "Humano" },
    minutosAtras,
    texto,
  }),
);

export type Notas = Nota[] | Map<number, Nota[]>;

/** Mesmo padrão de `indexarPorLead`: agrupa uma vez, consulta muitas. */
export function indexarNotas(notas: Nota[]) {
  const porLead = new Map<number, Nota[]>();
  for (const nota of notas) {
    const lista = porLead.get(nota.leadId);
    if (lista) lista.push(nota);
    else porLead.set(nota.leadId, [nota]);
  }
  return porLead;
}

/** As notas de um lead, da mais recente para a mais antiga. */
export function notasDoLead(notas: Notas, leadId: number) {
  const lista =
    notas instanceof Map
      ? (notas.get(leadId) ?? [])
      : notas.filter((n) => n.leadId === leadId);
  return [...lista].sort((a, b) => a.minutosAtras - b.minutosAtras);
}
