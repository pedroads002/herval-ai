import type { Autorizacao } from "@/lib/autorizacao";
import { carregarAutorizacao, ehHervalAdmin } from "@/lib/autorizacao";
import { criarClienteServidor } from "@/lib/supabase/servidor";

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
 *
 * **E não basta os ids baterem entre si.** Os dois são inteiros sequenciais, o
 * que torna qualquer par adivinhável por varredura — então, antes de qualquer
 * ida ao n8n, esta rota confere aqui no servidor de QUEM é a conversa: lê a
 * mensagem e o lead com a sessão de quem pediu e compara a operação do lead com
 * a operação da autorização do usuário. A Herval passa por ser Herval, não por
 * mandar um id a mais.
 *
 * Essa conferência não depende das políticas por operação, que ainda não
 * existem: ela compara papel, operação do usuário e operação do lead
 * explicitamente. Quando as políticas entrarem, viram uma segunda tranca sobre
 * a mesma porta — não o contrário.
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

/**
 * De quem é esta conversa, e esta pessoa pode vê-la?
 *
 * Duas leituras com o cliente da SESSÃO — nunca privilegiado, nunca
 * `service_role`. A operação sai de `leads.clinica_id`, que é dado do servidor;
 * nada do que o navegador manda além dos dois ids participa da decisão.
 *
 * São duas consultas em vez de uma com junção embutida porque aqui o que
 * importa é cada condição ser legível e conferível por separado — e porque a
 * forma do objeto embutido depende do cache de relacionamentos do PostgREST,
 * que é uma dependência a mais para uma decisão de segurança.
 */
async function podeVerAMidia(
  autorizacao: Autorizacao,
  mensagemId: number,
  leadId: number,
): Promise<boolean> {
  const supabase = await criarClienteServidor();

  // Os dois ids têm que descrever a MESMA linha. O filtro por `lead_id` é o
  // que impede um id de mensagem solto de puxar a conversa de outra pessoa.
  const { data: mensagem, error: erroDaMensagem } = await supabase
    .from("mensagens")
    .select("id")
    .eq("id", mensagemId)
    .eq("lead_id", leadId)
    .maybeSingle();

  // Erro de leitura é negativa, não exceção — a mesma regra do
  // `carregarAutorizacao`: banco fora do ar não libera arquivo de paciente.
  if (erroDaMensagem || !mensagem) return false;

  const { data: lead, error: erroDoLead } = await supabase
    .from("leads")
    .select("clinica_id")
    .eq("id", leadId)
    .maybeSingle();

  if (erroDoLead || !lead) return false;

  // Acesso global da Herval. É o papel que decide, não um id vindo da tela.
  // `ehHervalAdmin` confere papel E autorização ativa: quem chama já barrou
  // quem não está autorizado, e a função não depende disso para estar certa.
  if (ehHervalAdmin(autorizacao)) return true;

  const operacaoDoLead =
    typeof lead.clinica_id === "number" ? lead.clinica_id : null;

  // Lead sem operação é exclusivo da Herval, e a Herval já saiu acima.
  if (operacaoDoLead === null) return false;

  // Cliente só vê a própria operação. O `null` aqui não deveria acontecer (o
  // CHECK do banco e o `carregarAutorizacao` já garantem que cliente tem
  // operação), e é justamente por isso que ele é recusado em vez de ignorado.
  if (autorizacao.operacaoId === null) return false;

  return autorizacao.operacaoId === operacaoDoLead;
}

export async function GET(request: Request) {
  const autorizacao = await carregarAutorizacao();
  if (!autorizacao) return recusar("Sessão expirada.", 401);

  // Sem linha em `autorizacoes`, com a linha desativada ou com papel que o
  // código não conhece, `autorizado` é falso. Ausência de autorização nunca é
  // permissão: quem não está cadastrado não abre mídia de ninguém, nem a da
  // própria conversa.
  if (!autorizacao.autorizado) {
    return recusar("Acesso não autorizado.", 403);
  }

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

  if (!(await podeVerAMidia(autorizacao, mensagemId, leadId))) {
    // O MESMO 404 de mídia que a Evolution já apagou, de propósito. Mensagem
    // que não existe, mensagem de outro lead e conversa de outra operação
    // devolvem respostas indistinguíveis — é o que impede que a varredura dos
    // ids sirva para descobrir o que existe e de quem é.
    return recusar("Arquivo não disponível.", 404);
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
