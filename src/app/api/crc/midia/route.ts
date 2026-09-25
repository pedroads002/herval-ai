import { carregarPerfil } from "@/lib/perfil";

/**
 * O arquivo de uma mensagem de mídia — o áudio que o lead gravou, a foto que
 * ele mandou.
 *
 * Nada disso fica guardado aqui. O WhatsApp entrega as mídias por URLs
 * criptografadas, que não abrem no navegador e só a Evolution sabe decifrar;
 * copiar o arquivo para um armazenamento nosso criaria uma segunda versão do
 * mesmo áudio, com custo por gigabyte e liberdade para divergir da primeira.
 * Então o caminho é buscar na hora de exibir.
 *
 * É GET com parâmetros na URL, e não POST, porque quem consome isto é uma tag
 * `<img>` ou `<audio>` — elas só sabem fazer GET.
 *
 * **O navegador não diz qual arquivo quer.** Ele manda o id da mensagem e o do
 * lead; qual mídia buscar e de qual instância sai do banco, dentro do n8n. Os
 * dois ids precisam bater entre si: sem isso, um id de mensagem solto puxaria
 * a conversa de outra pessoa.
 */

const URL_DO_N8N = process.env.N8N_MIDIA_URL ?? "";
const TOKEN_DO_N8N = process.env.N8N_ENVIO_TOKEN ?? "";
const CABECALHO_DO_TOKEN = process.env.N8N_ENVIO_HEADER ?? "x-helo-token";

/** Buscar e decifrar mídia é mais lento que mandar texto. */
const LIMITE_DE_ESPERA = 30_000;

/** Tipos que o navegador sabe tocar e que a conversa pode conter. */
const TIPOS_PERMITIDOS = /^(image|audio|video)\//;

/**
 * SVG é imagem para o navegador, mas aceita `<script>` dentro.
 *
 * Servido da nossa origem, um SVG com script executaria como se fosse código
 * do painel — com acesso à sessão de quem está atendendo. O WhatsApp não
 * costuma entregar imagem nesse formato, mas o tipo vem de fora e "não
 * costuma" não é uma defesa.
 */
const TIPOS_BARRADOS = /^image\/svg/;

function recusar(motivo: string, status: number) {
  return new Response(motivo, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const perfil = await carregarPerfil();
  if (!perfil) return recusar("Sessão expirada.", 401);

  if (!URL_DO_N8N || !TOKEN_DO_N8N) {
    return recusar("A busca de mídia não está configurada neste ambiente.", 503);
  }

  const { searchParams } = new URL(request.url);
  const mensagemId = Number(searchParams.get("mensagemId"));
  const leadId = Number(searchParams.get("leadId"));

  if (!Number.isInteger(mensagemId) || mensagemId <= 0) {
    return recusar("Mensagem inválida.", 400);
  }
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return recusar("Lead inválido.", 400);
  }

  let resposta: Response;
  try {
    resposta = await fetch(URL_DO_N8N, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [CABECALHO_DO_TOKEN]: TOKEN_DO_N8N,
      },
      body: JSON.stringify({ mensagemId, leadId }),
      signal: AbortSignal.timeout(LIMITE_DE_ESPERA),
    });
  } catch {
    return recusar("Não deu para buscar o arquivo agora.", 502);
  }

  if (!resposta.ok) {
    return recusar(`O serviço de mídia recusou (HTTP ${resposta.status}).`, 502);
  }

  const resultado = (await resposta.json().catch(() => null)) as {
    achou?: boolean;
    motivo?: string;
    tipo?: string;
    base64?: string;
  } | null;

  if (!resultado?.achou || !resultado.base64) {
    // 404 e não 500: mídia que a Evolution já apagou é situação normal, não
    // defeito. A tela cai no rótulo ("Áudio enviado") em vez de mostrar erro.
    return recusar(resultado?.motivo ?? "Arquivo não disponível.", 404);
  }

  const tipo = (resultado.tipo ?? "").split(";")[0].trim();
  // O tipo vem de fora. Sem esta conferência, um valor inesperado viraria o
  // content-type da nossa resposta — e o navegador trataria o conteúdo como
  // aquilo que o remetente mandasse dizer que era.
  if (!TIPOS_PERMITIDOS.test(tipo) || TIPOS_BARRADOS.test(tipo)) {
    return recusar("Tipo de arquivo não suportado.", 415);
  }

  // `Buffer.from` com base64 não lança: caractere inválido é ignorado em
  // silêncio. Quem barra conteúdo imprestável é o tamanho, logo abaixo.
  const bytes = Buffer.from(resultado.base64, "base64");
  if (bytes.length === 0) return recusar("Arquivo vazio.", 404);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": tipo,
      "content-length": String(bytes.length),
      // Impede o navegador de adivinhar um tipo diferente do declarado, que
      // desfaria a conferência acima.
      "x-content-type-options": "nosniff",
      // Cache só no navegador de quem já está autenticado, e curto: a mídia
      // não muda, mas também não deve sobreviver ao fim do atendimento.
      "cache-control": "private, max-age=300",
    },
  });
}
