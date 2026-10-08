/**
 * A pausa do atendimento da Helô num lead.
 *
 * Mora num módulo próprio, sem banco nem sessão no caminho, porque três lados
 * precisam concordar sobre o mesmo fato: a leitura que desenha o botão, a rota
 * que grava o clique, e — quando a parte do n8n for feita — o freio que decide
 * se a IA responde. Enquanto a regra mora em três lugares, ela é livre para
 * discordar de si mesma, e o jeito que isso apareceria é o pior possível: o
 * painel dizendo "pausada" e a Helô respondendo de qualquer forma.
 *
 * O valor fica em `leads.atendimento_ia`, que é texto livre.
 */

/**
 * O único valor que significa pausada.
 *
 * É `"pause"` e não `"pausada"` porque o cérebro no n8n já gravava essa palavra
 * antes deste botão existir, e trocar o texto agora transformaria qualquer lead
 * pausado por aquele caminho antigo em lead ativo, sem ninguém pedir.
 */
export const IA_PAUSADA = "pause";

/**
 * Ativa é o padrão, e de propósito.
 *
 * A coluna é texto livre e nasce nula. Qualquer outra leitura — tratar nulo ou
 * valor desconhecido como pausado — faria o lead inteiro do banco começar
 * calado, e silêncio sem ninguém ter pedido é o defeito mais caro que esta tela
 * pode ter. O único valor que cala a Helô é o que alguém escreveu de propósito.
 */
export function iaEstaPausada(valor: string | null | undefined) {
  return valor === IA_PAUSADA;
}

/**
 * Quem pausou, quando não há nome para mostrar.
 *
 * O nome vem de `perfis.nome_completo`, e perfil em branco ainda existe hoje.
 * Quem pausa pelo painel é sempre um CRC, então é isso que o Log diz — e não
 * "Equipe", que era o texto antigo: no atendimento só existem o CRC e a Helô,
 * e um rótulo genérico some com a diferença entre os dois.
 *
 * Mora aqui, e não nos dois lados, porque a rota que grava a pausa e a leitura
 * que desenha a tela escrevem este mesmo texto. Duas cópias seriam duas
 * chances de o Log mostrar nomes diferentes para a mesma pausa.
 */
export const QUEM_PAUSOU_SEM_NOME = "um CRC";

/**
 * O relógio da pausa, "14:32", sempre no fuso de Brasília.
 *
 * Mesmo motivo de `dataEHoraDoPrazo`: a operação é toda no Brasil, e deixar o
 * fuso do navegador decidir faria o Log mostrar horas diferentes para quem
 * olha de lugares diferentes. Devolve `null` quando não há data gravada — a
 * pausa feita pelo n8n antes destas colunas existirem é exatamente esse caso.
 */
export function horaDaPausa(iso: string | null | undefined) {
  if (!iso) return null;

  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return null;

  return quando.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}
