import { type TipoAgente } from "@/data/historicoEtapas";

/**
 * A conversa com o lead. Até aqui a base guardava só o que a IA mandou, num
 * campo dentro da tarefa — o lead nunca aparecia, e quem não estava na fila
 * não tinha conversa nenhuma. Isso serve para um log, não para uma tela de
 * atendimento, onde o CRC precisa ler os dois lados.
 *
 * Por isso a mensagem virou entidade própria, ligada ao lead pelo id, no mesmo
 * molde de `agendamentos.ts`: um lead pode ter muitas, e quem quiser a conversa
 * pergunta por lead em vez de carregar junto com a operação da fila.
 */

/**
 * Quem falou. São os mesmos tipos de agente de `historicoEtapas.ts` mais o
 * próprio lead — a única voz da conversa que nunca é do nosso lado.
 *
 * "IA" é a Helô conversando, "Automática" é mensagem disparada por regra (a de
 * retomada, por exemplo) e "Humano" é o CRC assumindo a conversa na mão.
 */
export type TipoRemetente = "Lead" | TipoAgente;

export const tiposDeRemetente: TipoRemetente[] = [
  "Lead",
  "IA",
  "Automática",
  "Humano",
];

export type Remetente = {
  tipo: TipoRemetente;
  /** Nome de quem escreveu. Só em mensagem humana, vinda do usuário logado. */
  nome?: string;
};

/**
 * Texto, áudio, imagem ou vídeo. O formato importa porque a régua de
 * atendimento pede que a conversa seja majoritariamente em nota de voz depois
 * que as ligações falham — sem este campo não há como conferir se foi isso que
 * aconteceu. Imagem e vídeo entraram quando o WhatsApp real passou a alimentar
 * a tabela; o CHECK de `mensagens.formato` aceita os quatro.
 */
export type FormatoMensagem =
  | "texto"
  | "audio"
  | "imagem"
  | "video"
  | "reacao";

/** Os formatos que não são texto, com os dois rótulos que a tela usa. */
export const formatosDeMidia = {
  audio: { curto: "áudio", semTexto: "Áudio enviado" },
  imagem: { curto: "imagem", semTexto: "Imagem enviada" },
  video: { curto: "vídeo", semTexto: "Vídeo enviado" },
} as const;

export type FormatoDeMidia = keyof typeof formatosDeMidia;

/**
 * Mídia é áudio, imagem ou vídeo — os formatos que têm arquivo e podem chegar
 * sem legenda.
 *
 * A pergunta é por pertencimento, e não "diferente de texto", de propósito.
 * Enquanto era negação, qualquer formato novo virava mídia por omissão: ao
 * acrescentar "reacao" o `textoVisivel` foi procurar o rótulo de uma reação em
 * `formatosDeMidia`, não achou, e quebrou com TypeError em cima de uma
 * mensagem de lead. Perguntar pela lista faz o formato novo precisar se
 * declarar em vez de ser adotado por descuido.
 */
export function ehMidia(formato: FormatoMensagem): formato is FormatoDeMidia {
  return Object.prototype.hasOwnProperty.call(formatosDeMidia, formato);
}

/**
 * Reação é o emoji que o lead põe em cima de uma mensagem já enviada.
 *
 * Fica gravada na conversa, mas **não conta como um turno de fala**: um ❤️ num
 * "um abraço 😊" não é pergunta em aberto, e não deve devolver o lead para a
 * fila de quem espera resposta. Quem decide a fila olha a última mensagem que
 * não é reação.
 */
export function ehReacao(mensagem: Pick<Mensagem, "formato">) {
  return mensagem.formato === "reacao";
}

/**
 * O que a tela mostra no lugar do texto da mensagem.
 *
 * Áudio e vídeo chegam do WhatsApp sem legenda com frequência, e uma bolha
 * vazia não diz nada a quem está lendo a conversa. O rótulo é decisão de
 * exibição e mora aqui: o que está gravado continua sendo o texto real, vazio
 * como veio. Inventar conteúdo no banco seria pior que uma bolha sem graça —
 * quem lê o histórico depois não teria como saber o que o lead escreveu e o
 * que o sistema preencheu por ele.
 *
 * Mensagem de texto que chega vazia também ganha rótulo. Ela existe de
 * verdade: uma reação com emoji, por exemplo, chega do WhatsApp como um tipo
 * que o fluxo ainda não traduz, e vira uma linha sem conteúdo. Uma bolha em
 * branco na conversa parece defeito de carregamento — o rótulo pelo menos diz
 * que algo chegou e não foi entendido, que é a verdade.
 */
export function textoVisivel(mensagem: Pick<Mensagem, "texto" | "formato">) {
  const texto = mensagem.texto.trim();
  if (texto !== "") return texto;
  if (ehMidia(mensagem.formato)) return formatosDeMidia[mensagem.formato].semTexto;
  return "Mensagem sem texto";
}

/**
 * Confirmação vinda do WhatsApp. Nasce vazia de propósito: sem a integração
 * real não existe quem preencha, e inventar "lida" seria dado falso numa tela
 * em que o CRC decide o que fazer justamente por ver se o lead leu.
 */
export type StatusEntrega = "enviada" | "entregue" | "lida";

export type Mensagem = {
  id: number;
  leadId: number;
  remetente: Remetente;
  formato: FormatoMensagem;
  /** Há quantos minutos, na convenção de `lib/tempo.ts`. Nunca data fixa. */
  minutosAtras: number;
  texto: string;
  /** Regra da automação que disparou a mensagem. Vazia no que o lead escreve. */
  regra?: string;
  status?: StatusEntrega;
};

/**
 * Formato compacto, como no resto da base: uma linha por mensagem, com
 *
 *   [leadId, remetente, formato, minutosAtras, texto, regra]
 *
 * O remetente vem pela posição em `tiposDeRemetente` e o formato é 0 para
 * texto e 1 para áudio. O `id` é a ordem de leitura, e por isso não é gravado.
 * `regra` vazia vira campo ausente.
 *
 * As linhas estão em ordem de leitura da conversa: por lead, da mais antiga
 * para a mais recente (`minutosAtras` decrescente).
 *
 * Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
 * Quando esta tela passar a ler o banco, é este array que some.
 */
type LinhaMensagem = [number, number, number, number, string, string];

const registros: LinhaMensagem[] = [];

export const mensagensIniciais: Mensagem[] = registros.map(
  ([leadId, remetente, formato, minutosAtras, texto, regra], indice) => ({
    id: indice + 1,
    leadId,
    remetente: { tipo: tiposDeRemetente[remetente] },
    formato: formato === 1 ? "audio" : "texto",
    minutosAtras,
    texto,
    ...(regra ? { regra } : {}),
  }),
);

/** Mensagem do lead é a que chega; todo o resto é a clínica falando. */
export function ehDoLead(mensagem: Mensagem) {
  return mensagem.remetente.tipo === "Lead";
}

/**
 * Se esta mensagem conta como atendimento: alguém do nosso lado respondendo ao
 * que o lead disse. Só a IA e o humano contam.
 *
 * **"Automática" não conta, de propósito.** Uma mensagem automática é o
 * sistema avisando que ninguém atendeu — "primeiro contato, a IA não abre
 * conversa", "recebi seu áudio, pode escrever em texto?". Ela responde o
 * protocolo, não a pessoa.
 *
 * Enquanto o desempate era só "quem falou por último", essas mensagens tiravam
 * o lead de "Aguardando resposta" e o jogavam em "Já respondidos" — a fila de
 * quem um CRC ocupado olha por último. O lead que mais precisava de gente
 * sumia justamente por causa do aviso de que precisava de gente.
 *
 * Ressalva para quando a régua de retomada voltar: ela também manda mensagem
 * automática, mas para um lead que ficou em silêncio — ali quem deve a
 * resposta é o lead, e cair em "Aguardando" encheria a seção. Hoje esse
 * caminho está desligado (pende dos gatilhos agendados), então a regra simples
 * está certa; no dia em que ligar, o desempate passa a precisar da `regra` da
 * mensagem, e não só do remetente.
 */
export function ehAtendimento(mensagem: Pick<Mensagem, "remetente">) {
  const tipo = mensagem.remetente.tipo;
  return tipo === "IA" || tipo === "Humano";
}

/**
 * Agrupa a conversa por lead uma vez só. A tela abre um lead de cada vez, e
 * varrer as mensagens inteiras a cada abertura é o tipo de detalhe que só
 * incomoda quando a base cresce — o mesmo motivo de `indexarPorLead` existir
 * em `historicoEtapas.ts`.
 */
export function indexarMensagens(mensagens: Mensagem[]) {
  const porLead = new Map<number, Mensagem[]>();
  for (const mensagem of mensagens) {
    const lista = porLead.get(mensagem.leadId);
    if (lista) lista.push(mensagem);
    else porLead.set(mensagem.leadId, [mensagem]);
  }
  return porLead;
}

export type Conversas = Mensagem[] | Map<number, Mensagem[]>;

/** A conversa de um lead, da mais antiga para a mais recente. */
export function conversaDoLead(mensagens: Conversas, leadId: number) {
  const lista =
    mensagens instanceof Map
      ? (mensagens.get(leadId) ?? [])
      : mensagens.filter((m) => m.leadId === leadId);
  return [...lista].sort((a, b) => b.minutosAtras - a.minutosAtras);
}

/** A última coisa dita na conversa, de qualquer lado. Nulo em quem não falou. */
export function ultimaMensagem(mensagens: Conversas, leadId: number) {
  const conversa = conversaDoLead(mensagens, leadId);
  return conversa[conversa.length - 1] ?? null;
}

/**
 * A última fala de verdade: a mensagem mais recente que não é reação.
 *
 * Existe separada de `ultimaMensagem` porque as duas respondem perguntas
 * diferentes. "O que apareceu por último na conversa" é o que a lista mostra
 * no trecho — e aí a reação conta, porque ela aconteceu. "Quem falou por
 * último" é o que decide a fila e há quanto tempo o lead espera — e aí a
 * reação não conta.
 *
 * Sem essa separação, um lead que perguntou às 10h, reagiu a um emoji às
 * 10h05 e continua sem resposta às 11h apareceria esperando cinco minutos em
 * vez de uma hora, e cairia para o fim da fila por causa do próprio ❤️.
 *
 * Nulo quando só houve reação e mais nada — alguém que interagiu sem nunca ter
 * sido atendido.
 */
export function ultimaFala(mensagens: Conversas, leadId: number) {
  const conversa = conversaDoLead(mensagens, leadId);
  for (let i = conversa.length - 1; i >= 0; i--) {
    if (!ehReacao(conversa[i])) return conversa[i];
  }
  return null;
}
