/**
 * As ligações do CRC para o lead. A Helô nunca liga: telefone é sempre ação
 * humana, e é por isso que não existe agente aqui como existe em
 * `historicoEtapas.ts` — se há registro de ligação, foi alguém do CRC.
 *
 * A régua de atendimento é uma rajada na chegada do lead: três tentativas pelo
 * discador, duas por chamada de WhatsApp e, oito horas depois da primeira, uma
 * sexta tentativa de recuperação só por WhatsApp. O que este arquivo guarda é
 * o que aconteceu; a régua que decide a próxima tentativa é assunto de outra
 * fase.
 */

export type CanalDeLigacao = "discador" | "whatsapp";

export const canaisDeLigacao: CanalDeLigacao[] = ["discador", "whatsapp"];

export type DesfechoDaLigacao = "atendida" | "não atendida";

export type Ligacao = {
  id: number;
  leadId: number;
  canal: CanalDeLigacao;
  /** Posição na sequência, de 1 a 6. A sexta é a tentativa de recuperação. */
  tentativa: number;
  /** Há quantos minutos, na convenção de `lib/tempo.ts`. Nunca data fixa. */
  minutosAtras: number;
  desfecho: DesfechoDaLigacao;
};

// Quantas tentativas cabem em cada canal, e quanto se espera até a de
// recuperação, ficam em `metas.ts`: são números combinados com o cliente, não
// característica do registro. Este arquivo guarda o que aconteceu.

/**
 * Formato compacto, como no resto da base. Cada linha é
 *
 *   [leadId, canal, tentativa, minutosAtras, desfecho]
 *
 * com canal pela posição em `canaisDeLigacao`, desfecho 0 para não atendida e
 * 1 para atendida, e o `id` saindo da ordem de leitura.
 *
 * Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
 * Quando esta tela passar a ler o banco, é este array que some.
 */
type LinhaLigacao = [number, number, number, number, number];

const registros: LinhaLigacao[] = [];

export const ligacoesIniciais: Ligacao[] = registros.map(
  ([leadId, canal, tentativa, minutosAtras, desfecho], indice) => ({
    id: indice + 1,
    leadId,
    canal: canaisDeLigacao[canal],
    tentativa,
    minutosAtras,
    desfecho: desfecho === 1 ? "atendida" : "não atendida",
  }),
);

export type Ligacoes = Ligacao[] | Map<number, Ligacao[]>;

/** Mesmo padrão de `indexarPorLead`: agrupa uma vez, consulta muitas. */
export function indexarLigacoes(ligacoes: Ligacao[]) {
  const porLead = new Map<number, Ligacao[]>();
  for (const ligacao of ligacoes) {
    const lista = porLead.get(ligacao.leadId);
    if (lista) lista.push(ligacao);
    else porLead.set(ligacao.leadId, [ligacao]);
  }
  return porLead;
}

/** As tentativas de um lead, da mais antiga para a mais recente. */
export function ligacoesDoLead(ligacoes: Ligacoes, leadId: number) {
  const lista =
    ligacoes instanceof Map
      ? (ligacoes.get(leadId) ?? [])
      : ligacoes.filter((l) => l.leadId === leadId);
  return [...lista].sort((a, b) => b.minutosAtras - a.minutosAtras);
}

/**
 * A primeira tentativa é o marco de duas regras: é dela que se contam as oito
 * horas até a ligação de recuperação, e é ela que a especificação passou a
 * usar como primeiro contato do lead. Por isso tem função própria, em vez de
 * cada tela varrer a lista do seu jeito.
 */
export function primeiraTentativa(ligacoes: Ligacoes, leadId: number) {
  return ligacoesDoLead(ligacoes, leadId)[0] ?? null;
}

/**
 * Quantas tentativas houve em cada canal. Contado pelos registros, e não
 * guardado num campo à parte: contador solto é o que começa a divergir do que
 * de fato aconteceu.
 */
export function tentativasPorCanal(ligacoes: Ligacoes, leadId: number) {
  const contagem: Record<CanalDeLigacao, number> = { discador: 0, whatsapp: 0 };
  for (const ligacao of ligacoesDoLead(ligacoes, leadId)) {
    contagem[ligacao.canal] += 1;
  }
  return contagem;
}
