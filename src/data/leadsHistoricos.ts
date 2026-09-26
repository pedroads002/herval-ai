import {
  etapasFunil,
  motivosDePerda,
  origensContato,
  type Lead,
} from "@/data/leads";

/**
 * Leads das safras anteriores: já saíram da fila de trabalho, mas continuam
 * valendo para os relatórios. Junto com os leads de `tarefas.ts` formam a base
 * completa — nenhum lead aparece nos dois lugares.
 *
 * Ficam em formato compacto porque são milhares. Cada linha é:
 * [id, clinicaId, etapa, origem, diasAtras, motivoPerda, valorVenda, remarcações]
 * com etapa, origem e motivo pela posição na lista correspondente; -1 em motivo
 * e 0 em valor significam "não se aplica". A função abaixo devolve o lead no
 * formato normal, então o resto do sistema não precisa saber disso.
 *
 * Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
 * Quando esta tela passar a ler o banco, é este array que some.
 */
type LinhaLead = [
  number, number, number, number, number, number, number, number,
];

const registros: LinhaLead[] = [];

export const leadsHistoricos: Lead[] = registros.map(
  ([id, clinicaId, etapa, origem, diasAtras, motivo, valor, remarcacoes]) => ({
    id,
    clinicaId,
    etapa: etapasFunil[etapa],
    origem: origensContato[origem],
    diasAtras,
    ...(motivo >= 0 ? { motivoPerda: motivosDePerda[motivo] } : {}),
    ...(valor > 0 ? { valorVenda: valor } : {}),
    ...(remarcacoes > 0 ? { remarcacoes } : {}),
  }),
);
