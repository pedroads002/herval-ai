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
 * Dados de exemplo. Ainda não vêm de banco nem de API.
 */
type LinhaNota = [number, number, string];

const registros: LinhaNota[] = [
  [2, 2840, "Só consegue vir depois das 18h por causa do trabalho."],
  [5, 2847, "Pediu para confirmar por mensagem no dia anterior."],
  [10, 18072, "Achou o valor alto mesmo com o parcelamento. Pediu para avisar se abrir condição melhor."],
  [13, 4206, "Pediu para confirmar por mensagem no dia anterior."],
  [14, 8601, "Pediu para não ligar em horário comercial, prefere mensagem."],
  [16, 11415, "Só consegue vir depois das 18h por causa do trabalho."],
  [22, 2786, "Desmarcou em cima da hora por problema no trabalho."],
  [25, 21017, "Respondeu no começo e depois não voltou mais. Já tentei nos dois canais."],
  [26, 2118, "Mora em outra cidade e não tem como vir nem para a avaliação."],
  [28, 19044, "Estava pesquisando preço, sem intenção de agendar agora."],
  [33, 9961, "Desmarcou em cima da hora por problema no trabalho."],
  [35, 1819, "Sumiu depois que pedi para confirmar o horário."],
  [36, 5871, "Quer fazer, mas só depois das férias. Retomar no mês que vem."],
  [37, 5584, "Pediu para manter contato. Não é agora, mas tem interesse real."],
  [41, 14728, "Quer fazer, mas só depois das férias. Retomar no mês que vem."],
  [42, 11698, "Quer fazer, mas só consegue no ano que vem. Sem pressa nenhuma."],
  [43, 4300, "Veio acompanhada. Gostou da proposta, vai falar com o marido."],
  [44, 12025, "Pediu para manter contato. Não é agora, mas tem interesse real."],
  [46, 10364, "Quer fazer, mas só depois das férias. Retomar no mês que vem."],
  [49, 0, "Compareceu no horário. Ficou de decidir o pacote em casa."],
  [50, 11223, "Quer fazer, mas só depois das férias. Retomar no mês que vem."],
  [52, 30459, "Quer fazer, mas só depois das férias. Retomar no mês que vem."],
  [53, 16101, "Fechou na própria avaliação. Sem objeção de preço."],
  [54, 15285, "Fechou na própria avaliação. Sem objeção de preço."],
  [55, 23033, "Fechou na própria avaliação. Sem objeção de preço."],
  [56, 4890, "Já veio decidida. Só quis entender o pós-procedimento."],
  [57, 11299, "Fechou na própria avaliação. Sem objeção de preço."],
  [58, 2440, "Fechou o pacote depois de ver os resultados de outra paciente."],
  [59, 20958, "Fechou o pacote depois de ver os resultados de outra paciente."],
  [60, 9608, "Fechou o pacote depois de ver os resultados de outra paciente."],
  [61, 8852, "Comparou com uma clínica mais barata. Disse que o orçamento não cabe agora."],
  [62, 6090, "Achou o valor alto mesmo com o parcelamento. Pediu para avisar se abrir condição melhor."],
  [63, 4603, "Achou o valor alto mesmo com o parcelamento. Pediu para avisar se abrir condição melhor."],
  [64, 1930, "Comparou com uma clínica mais barata. Disse que o orçamento não cabe agora."],
  [65, 12985, "Parou de responder depois do orçamento. Duas tentativas sem retorno."],
  [66, 10878, "Sumiu depois que pedi para confirmar o horário."],
  [67, 13570, "Sumiu depois que pedi para confirmar o horário."],
  [68, 1408, "Sumiu depois que pedi para confirmar o horário."],
  [69, 8621, "Perguntou se atendemos online. Expliquei que a avaliação é presencial."],
  [70, 4225, "Perguntou se atendemos online. Expliquei que a avaliação é presencial."],
  [71, 8543, "Disse que quem faz o procedimento é a irmã, ela só perguntou por ela."],
  [72, 11462, "Estava pesquisando preço, sem intenção de agendar agora."],
  [73, 17965, "Parou de responder depois do orçamento. Duas tentativas sem retorno."],
  [74, 10983, "Respondeu no começo e depois não voltou mais. Já tentei nos dois canais."],
];

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
