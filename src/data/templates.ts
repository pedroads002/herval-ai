/**
 * Os tipos dos templates de WhatsApp.
 *
 * O conteúdo de exemplo saiu daqui: a tela lê e grava em `template_categorias`,
 * `templates` e `template_mensagens` — ver `lib/dados/templates.ts` e
 * `lib/acoes/templates.ts`. O que ficou é só a forma dos dados.
 *
 * Mora em `data/` pelo mesmo motivo de `data/followUp.ts`: este arquivo não
 * importa nada de servidor, então o componente de tela pode usar os tipos sem
 * arrastar o cliente do Supabase para o navegador.
 */

/** Os quatro formatos que o CHECK de `template_mensagens.formato` aceita. */
export const FORMATOS_DE_MENSAGEM = [
  "texto",
  "audio",
  "imagem",
  "video",
] as const;

export type FormatoDeMensagem = (typeof FORMATOS_DE_MENSAGEM)[number];

/** Como cada formato se chama na tela. */
export const NOME_DO_FORMATO: Record<FormatoDeMensagem, string> = {
  texto: "Texto",
  audio: "Áudio",
  imagem: "Imagem",
  video: "Vídeo",
};

/**
 * Uma "bolha" do template, na ordem em que é enviada.
 *
 * `texto` é a mensagem quando o formato é texto, e a legenda quando é mídia —
 * é a mesma coluna no banco, e o CHECK exige que ao menos um dos dois exista.
 * `delaySegundos` é a espera antes de mandar esta bolha, não depois.
 */
export type MensagemDoTemplate = {
  id: number;
  ordem: number;
  formato: FormatoDeMensagem;
  texto: string | null;
  midiaUrl: string | null;
  delaySegundos: number;
};

/**
 * Um template de uma clínica em uma categoria.
 *
 * Pode haver vários na mesma categoria ao longo do tempo, mas só um com
 * `ativo` — é o que o índice único `templates_ativo_unico_por_categoria`
 * garante, e é o que a Helô envia.
 */
export type TemplateDoCliente = {
  id: number;
  categoriaId: number;
  nome: string;
  ativo: boolean;
  mensagens: MensagemDoTemplate[];
};

/**
 * Uma categoria, que é o momento do fluxo que dispara o template.
 *
 * `chave` é o nome que o n8n usa para achar o template certo; `nomeExibicao` é
 * o que aparece na tela. As que começam com `agendamento_` aparecem juntas,
 * sob um cabeçalho só — ver `ehDeAgendamento`.
 */
export type CategoriaDeTemplate = {
  id: number;
  chave: string;
  nomeExibicao: string;
  ordem: number;
};

const PREFIXO_DE_AGENDAMENTO = "agendamento_";

/** Se a categoria entra no grupo "Agendamento" da tela. */
export function ehDeAgendamento(categoria: CategoriaDeTemplate): boolean {
  return categoria.chave.startsWith(PREFIXO_DE_AGENDAMENTO);
}

/**
 * O nome curto para quando a categoria já está debaixo do cabeçalho
 * "Agendamento": o banco grava "Agendamento - Lembrete 24h antes", e repetir a
 * palavra em cima e embaixo só gasta linha.
 *
 * Se o nome gravado não tiver o prefixo, volta inteiro — nunca corta no
 * escuro.
 */
export function nomeCurtoDaCategoria(categoria: CategoriaDeTemplate): string {
  const separador = " - ";
  const posicao = categoria.nomeExibicao.indexOf(separador);

  if (!ehDeAgendamento(categoria) || posicao < 0) {
    return categoria.nomeExibicao;
  }

  return categoria.nomeExibicao.slice(posicao + separador.length);
}
