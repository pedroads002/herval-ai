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
 * Dados de exemplo. Ainda não vêm de banco nem de API.
 */
type LinhaLigacao = [number, number, number, number, number];

const registros: LinhaLigacao[] = [
  [1, 0, 1, 2880, 0],
  [1, 0, 2, 2879, 0],
  [1, 0, 3, 2879, 0],
  [1, 1, 4, 2879, 0],
  [1, 1, 5, 2879, 0],
  [2, 0, 1, 5746, 0],
  [2, 0, 2, 5744, 1],
  [3, 0, 1, 7191, 0],
  [3, 0, 2, 7190, 0],
  [3, 0, 3, 7189, 0],
  [3, 1, 4, 7188, 0],
  [3, 1, 5, 7184, 0],
  [3, 1, 6, 6711, 0],
  [4, 0, 1, 2880, 0],
  [4, 0, 2, 2879, 0],
  [4, 0, 3, 2878, 0],
  [4, 1, 4, 2878, 0],
  [4, 1, 5, 2878, 0],
  [5, 0, 1, 4317, 1],
  [6, 0, 1, 1440, 0],
  [6, 0, 2, 1439, 0],
  [6, 0, 3, 1439, 0],
  [6, 1, 4, 1439, 0],
  [6, 1, 5, 1439, 0],
  [8, 0, 1, 361, 0],
  [8, 0, 2, 360, 0],
  [8, 0, 3, 359, 0],
  [8, 1, 4, 356, 0],
  [8, 1, 5, 354, 0],
  [9, 0, 1, 1440, 0],
  [9, 0, 2, 1439, 0],
  [9, 0, 3, 1438, 0],
  [9, 1, 4, 1438, 0],
  [9, 1, 5, 1438, 0],
  [10, 0, 1, 38680, 0],
  [10, 0, 2, 38676, 0],
  [10, 0, 3, 38673, 0],
  [10, 1, 4, 38671, 0],
  [10, 1, 5, 38668, 0],
  [11, 0, 1, 15, 0],
  [11, 0, 2, 12, 0],
  [11, 0, 3, 10, 0],
  [11, 1, 4, 6, 0],
  [11, 1, 5, 5, 0],
  [12, 0, 1, 1440, 0],
  [12, 0, 2, 1439, 0],
  [12, 0, 3, 1438, 0],
  [12, 1, 4, 1437, 0],
  [12, 1, 5, 1436, 0],
  [13, 0, 1, 4329, 0],
  [13, 0, 2, 4328, 0],
  [13, 0, 3, 4326, 0],
  [13, 1, 4, 4323, 0],
  [13, 1, 5, 4322, 0],
  [14, 0, 1, 10079, 0],
  [14, 0, 2, 10076, 1],
  [15, 0, 1, 8640, 0],
  [15, 0, 2, 8638, 0],
  [15, 0, 3, 8636, 0],
  [15, 1, 4, 8635, 0],
  [15, 1, 5, 8634, 0],
  [15, 1, 6, 8160, 0],
  [16, 0, 1, 12959, 1],
  [17, 0, 1, 7686, 0],
  [17, 0, 2, 7683, 0],
  [17, 0, 3, 7679, 0],
  [17, 1, 4, 7675, 0],
  [17, 1, 5, 7673, 0],
  [17, 1, 6, 7206, 0],
  [18, 0, 1, 7198, 0],
  [18, 0, 2, 7194, 0],
  [18, 0, 3, 7193, 0],
  [18, 1, 4, 7192, 0],
  [18, 1, 5, 7189, 0],
  [18, 1, 6, 6718, 0],
  [19, 0, 1, 7138, 0],
  [19, 0, 2, 7135, 0],
  [19, 0, 3, 7131, 0],
  [19, 1, 4, 7129, 0],
  [19, 1, 5, 7126, 0],
  [19, 1, 6, 6658, 0],
  [20, 0, 1, 4320, 0],
  [20, 0, 2, 4319, 0],
  [20, 0, 3, 4318, 0],
  [20, 1, 4, 4318, 0],
  [20, 1, 5, 4318, 0],
  [21, 0, 1, 11637, 0],
  [21, 0, 2, 11636, 0],
  [21, 0, 3, 11633, 0],
  [21, 1, 4, 11632, 0],
  [21, 1, 5, 11631, 0],
  [21, 1, 6, 11157, 0],
  [22, 0, 1, 18682, 1],
  [23, 0, 1, 11520, 0],
  [23, 0, 2, 11519, 0],
  [23, 0, 3, 11518, 0],
  [23, 1, 4, 11518, 0],
  [23, 1, 5, 11518, 0],
  [23, 1, 6, 11040, 0],
  [24, 0, 1, 11473, 0],
  [24, 0, 2, 11470, 0],
  [24, 0, 3, 11467, 0],
  [24, 1, 4, 11466, 0],
  [24, 1, 5, 11465, 0],
  [24, 1, 6, 10993, 0],
  [25, 0, 1, 40306, 0],
  [25, 0, 2, 40303, 0],
  [25, 0, 3, 40301, 0],
  [25, 1, 4, 40300, 0],
  [25, 1, 5, 40299, 0],
  [26, 0, 1, 8629, 0],
  [26, 0, 2, 8627, 0],
  [26, 0, 3, 8624, 0],
  [26, 1, 4, 8622, 0],
  [26, 1, 5, 8619, 0],
  [27, 0, 1, 4320, 0],
  [27, 0, 2, 4319, 0],
  [27, 0, 3, 4318, 0],
  [27, 1, 4, 4317, 0],
  [27, 1, 5, 4317, 0],
  [27, 1, 6, 3840, 0],
  [28, 0, 1, 48826, 0],
  [28, 0, 2, 48824, 0],
  [28, 0, 3, 48820, 0],
  [28, 1, 4, 48819, 0],
  [28, 1, 5, 48816, 0],
  [29, 0, 1, 2880, 0],
  [29, 0, 2, 2879, 0],
  [29, 0, 3, 2878, 0],
  [29, 1, 4, 2877, 0],
  [29, 1, 5, 2876, 0],
  [29, 1, 6, 2400, 0],
  [30, 0, 1, 20160, 0],
  [30, 0, 2, 20159, 0],
  [30, 0, 3, 20159, 0],
  [30, 1, 4, 20159, 0],
  [30, 1, 5, 20159, 0],
  [30, 1, 6, 19680, 0],
  [32, 0, 1, 14045, 0],
  [32, 0, 2, 14042, 0],
  [32, 0, 3, 14041, 0],
  [32, 1, 4, 14040, 0],
  [32, 1, 5, 14037, 0],
  [32, 1, 6, 13565, 0],
  [33, 0, 1, 20145, 0],
  [33, 0, 2, 20143, 0],
  [33, 0, 3, 20142, 1],
  [34, 0, 1, 1418, 0],
  [34, 0, 2, 1414, 0],
  [34, 0, 3, 1412, 0],
  [34, 1, 4, 1411, 0],
  [34, 1, 5, 1408, 0],
  [34, 1, 6, 938, 0],
  [35, 0, 1, 4320, 0],
  [35, 0, 2, 4317, 0],
  [35, 0, 3, 4315, 0],
  [35, 1, 4, 4312, 0],
  [35, 1, 5, 4310, 0],
  [36, 0, 1, 24145, 0],
  [36, 0, 2, 24142, 0],
  [36, 0, 3, 24138, 0],
  [36, 1, 4, 24135, 0],
  [36, 1, 5, 24133, 0],
  [37, 0, 1, 21600, 0],
  [37, 0, 2, 21599, 0],
  [37, 0, 3, 21598, 0],
  [37, 1, 4, 21598, 0],
  [37, 1, 5, 21598, 0],
  [40, 0, 1, 5760, 0],
  [40, 0, 2, 5759, 0],
  [40, 0, 3, 5758, 0],
  [40, 1, 4, 5757, 0],
  [40, 1, 5, 5756, 0],
  [40, 1, 6, 5280, 0],
  [41, 0, 1, 48875, 0],
  [41, 0, 2, 48874, 0],
  [41, 0, 3, 48873, 0],
  [41, 1, 4, 48872, 0],
  [41, 1, 5, 48871, 0],
  [42, 0, 1, 27353, 0],
  [42, 0, 2, 27349, 0],
  [42, 0, 3, 27346, 0],
  [42, 1, 4, 27343, 0],
  [42, 1, 5, 27342, 0],
  [43, 0, 1, 14398, 1],
  [44, 0, 1, 48953, 0],
  [44, 0, 2, 48950, 0],
  [44, 0, 3, 48948, 0],
  [44, 1, 4, 48946, 0],
  [44, 1, 5, 48942, 0],
  [45, 0, 1, 5760, 0],
  [45, 0, 2, 5758, 0],
  [45, 0, 3, 5757, 0],
  [45, 1, 4, 5756, 0],
  [45, 1, 5, 5755, 0],
  [45, 1, 6, 5280, 0],
  [46, 0, 1, 24480, 0],
  [46, 0, 2, 24479, 0],
  [46, 0, 3, 24479, 0],
  [46, 1, 4, 24479, 0],
  [46, 1, 5, 24479, 0],
  [49, 0, 1, 11533, 0],
  [49, 0, 2, 11531, 0],
  [49, 0, 3, 11527, 0],
  [49, 1, 4, 11524, 0],
  [49, 1, 5, 11522, 0],
  [50, 0, 1, 48940, 0],
  [50, 0, 2, 48937, 0],
  [50, 0, 3, 48933, 0],
  [50, 1, 4, 48932, 0],
  [50, 1, 5, 48929, 0],
  [51, 0, 1, 4280, 0],
  [51, 0, 2, 4278, 0],
  [51, 0, 3, 4274, 0],
  [51, 1, 4, 4270, 0],
  [51, 1, 5, 4269, 0],
  [51, 1, 6, 3800, 0],
  [52, 0, 1, 55252, 0],
  [52, 0, 2, 55251, 0],
  [52, 0, 3, 55250, 0],
  [52, 1, 4, 55247, 0],
  [52, 1, 5, 55245, 0],
  [53, 0, 1, 47528, 0],
  [53, 0, 2, 47527, 0],
  [53, 0, 3, 47526, 0],
  [53, 1, 4, 47524, 0],
  [53, 1, 5, 47522, 0],
  [54, 0, 1, 38880, 0],
  [54, 0, 2, 38879, 0],
  [54, 0, 3, 38878, 0],
  [54, 1, 4, 38878, 0],
  [54, 1, 5, 38878, 0],
  [55, 0, 1, 44633, 1],
  [56, 0, 1, 18710, 0],
  [56, 0, 2, 18706, 1],
  [57, 0, 1, 30240, 0],
  [57, 0, 2, 30239, 0],
  [57, 0, 3, 30238, 0],
  [57, 1, 4, 30237, 0],
  [57, 1, 5, 30237, 0],
  [58, 0, 1, 20156, 1],
  [59, 0, 1, 47301, 1],
  [60, 0, 1, 34330, 1],
  [61, 0, 1, 31680, 0],
  [61, 0, 2, 31679, 0],
  [61, 0, 3, 31678, 0],
  [61, 1, 4, 31677, 0],
  [61, 1, 5, 31676, 0],
  [62, 0, 1, 24150, 0],
  [62, 0, 2, 24146, 0],
  [62, 0, 3, 24144, 0],
  [62, 1, 4, 24140, 0],
  [62, 1, 5, 24137, 0],
  [63, 0, 1, 18707, 0],
  [63, 0, 2, 18706, 0],
  [63, 0, 3, 18705, 0],
  [63, 1, 4, 18704, 0],
  [63, 1, 5, 18703, 0],
  [64, 0, 1, 2880, 0],
  [64, 0, 2, 2878, 0],
  [64, 0, 3, 2876, 0],
  [64, 1, 4, 2875, 0],
  [64, 1, 5, 2873, 0],
  [65, 0, 1, 38880, 0],
  [65, 0, 2, 38878, 0],
  [65, 0, 3, 38877, 0],
  [65, 1, 4, 38876, 0],
  [65, 1, 5, 38875, 0],
  [66, 0, 1, 23040, 0],
  [66, 0, 2, 23039, 0],
  [66, 0, 3, 23038, 0],
  [66, 1, 4, 23038, 0],
  [66, 1, 5, 23038, 0],
  [67, 0, 1, 51840, 0],
  [67, 0, 2, 51839, 0],
  [67, 0, 3, 51838, 0],
  [67, 1, 4, 51838, 0],
  [67, 1, 5, 51838, 0],
  [68, 0, 1, 1440, 0],
  [68, 0, 2, 1439, 0],
  [68, 0, 3, 1438, 0],
  [68, 1, 4, 1438, 0],
  [68, 1, 5, 1438, 0],
  [69, 0, 1, 27360, 0],
  [69, 0, 2, 27359, 0],
  [69, 0, 3, 27356, 0],
  [69, 1, 4, 27352, 0],
  [69, 1, 5, 27349, 0],
  [70, 0, 1, 10038, 0],
  [70, 0, 2, 10034, 0],
  [70, 0, 3, 10032, 0],
  [70, 1, 4, 10030, 0],
  [70, 1, 5, 10028, 0],
  [71, 0, 1, 25490, 0],
  [71, 0, 2, 25487, 0],
  [71, 0, 3, 25483, 0],
  [71, 1, 4, 25479, 0],
  [71, 1, 5, 25475, 0],
  [72, 0, 1, 44171, 0],
  [72, 0, 2, 44167, 0],
  [72, 0, 3, 44165, 0],
  [72, 1, 4, 44163, 0],
  [72, 1, 5, 44162, 0],
  [73, 0, 1, 51661, 0],
  [73, 0, 2, 51657, 0],
  [73, 0, 3, 51656, 0],
  [73, 1, 4, 51652, 0],
  [73, 1, 5, 51648, 0],
  [74, 0, 1, 27360, 0],
  [74, 0, 2, 27359, 0],
  [74, 0, 3, 27358, 0],
  [74, 1, 4, 27358, 0],
  [74, 1, 5, 27358, 0],
];

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
