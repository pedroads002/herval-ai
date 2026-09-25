import { NextResponse } from "next/server";
import { carregarPerfil } from "@/lib/perfil";

/**
 * O envio manual do CRC: o que a equipe escreve na tela de atendimento sai
 * daqui para o WhatsApp do lead.
 *
 * Esta rota não fala com a Evolution API — ela chama um webhook do n8n, que
 * resolve o destino no banco, envia e grava a mensagem. O motivo de passar
 * pelo n8n em vez de mandar direto: a credencial da Evolution fica num lugar
 * só. Se o painel falasse direto, a mesma chave passaria a existir também no
 * servidor do Next, e seriam dois lugares para girar quando ela mudar.
 *
 * Duas coisas que o navegador NÃO decide, de propósito:
 *
 * - **Para quem vai.** O telefone e a instância saem do banco, dentro do n8n.
 *   O que vem daqui é usado para conferir, não para endereçar.
 * - **Quem está falando.** O autor sai da sessão do Supabase, no servidor.
 *   Um cliente adulterado não consegue assinar como outra pessoa.
 */

const URL_DO_N8N = process.env.N8N_ENVIO_URL ?? "";
const TOKEN_DO_N8N = process.env.N8N_ENVIO_TOKEN ?? "";
const CABECALHO_DO_TOKEN = process.env.N8N_ENVIO_HEADER ?? "x-helo-token";

/** Acima disso, é melhor devolver erro que deixar o CRC olhando a tela. */
const LIMITE_DE_ESPERA = 20_000;

type Pedido = {
  leadId?: unknown;
  telefone?: unknown;
  texto?: unknown;
  midia?: unknown;
};

/** Os três formatos que a conversa sabe mostrar e a Evolution sabe mandar. */
const FORMATOS_DE_MIDIA = ["imagem", "audio", "video"] as const;
type FormatoDeMidia = (typeof FORMATOS_DE_MIDIA)[number];

/**
 * Quanto arquivo cabe num envio.
 *
 * A Vercel recusa corpo acima de 4,5 MB antes de esta rota sequer rodar — o
 * CRC veria um erro sem explicação, vindo de um lugar que não controlamos. E
 * base64 engorda o arquivo em um terço: 3 MB de foto viram 4 MB de texto.
 *
 * Três megabytes deixam folga para o resto do pedido e cobrem com sobra o que
 * um celular manda pelo WhatsApp, que já comprime antes de enviar.
 */
const LIMITE_DO_ARQUIVO = 3 * 1024 * 1024;

/** Quantos bytes um texto base64 vira, sem precisar decodificar para medir. */
function bytesDoBase64(base64: string) {
  const enchimento = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - enchimento;
}

function recusar(motivo: string, status: number) {
  return NextResponse.json({ enviada: false, motivo }, { status });
}

export async function POST(request: Request) {
  const perfil = await carregarPerfil();
  if (!perfil) {
    return recusar("Sua sessão expirou. Entre de novo para enviar.", 401);
  }

  if (!URL_DO_N8N || !TOKEN_DO_N8N) {
    return recusar(
      "O envio não está configurado neste ambiente. Falta N8N_ENVIO_URL ou N8N_ENVIO_TOKEN.",
      503,
    );
  }

  let pedido: Pedido;
  try {
    pedido = (await request.json()) as Pedido;
  } catch {
    return recusar("Pedido malformado.", 400);
  }

  const leadId = Number(pedido.leadId);
  const telefone = String(pedido.telefone ?? "").trim();
  const texto = String(pedido.texto ?? "").trim();

  if (!Number.isInteger(leadId) || leadId <= 0) {
    return recusar("Lead inválido.", 400);
  }
  if (telefone === "") {
    return recusar("Lead sem telefone: não há para onde enviar.", 400);
  }

  /**
   * A mídia é opcional. Quando vem, o texto vira legenda e pode ser vazio —
   * mandar uma foto sem dizer nada é normal numa conversa.
   */
  const bruta = pedido.midia;
  let midia: { tipo: FormatoDeMidia; base64: string } | null = null;

  if (bruta !== undefined && bruta !== null) {
    if (typeof bruta !== "object") {
      return recusar("Mídia malformada.", 400);
    }
    const { tipo, base64 } = bruta as { tipo?: unknown; base64?: unknown };

    if (!FORMATOS_DE_MIDIA.includes(tipo as FormatoDeMidia)) {
      return recusar(
        "Só dá para enviar imagem, áudio ou vídeo por aqui.",
        415,
      );
    }
    if (typeof base64 !== "string" || base64 === "") {
      return recusar("O arquivo chegou vazio.", 400);
    }
    // O tamanho é conferido aqui também, e não só no navegador: a checagem de
    // lá evita a viagem inútil, esta impede que alguém a contorne.
    if (bytesDoBase64(base64) > LIMITE_DO_ARQUIVO) {
      return recusar(
        `O arquivo passa de ${LIMITE_DO_ARQUIVO / 1024 / 1024} MB. Mande um menor.`,
        413,
      );
    }
    midia = { tipo: tipo as FormatoDeMidia, base64 };
  }

  if (!midia && texto === "") {
    return recusar("A mensagem está vazia.", 400);
  }

  let resposta: Response;
  try {
    resposta = await fetch(URL_DO_N8N, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [CABECALHO_DO_TOKEN]: TOKEN_DO_N8N,
      },
      body: JSON.stringify({
        leadId,
        telefone,
        texto,
        autor: perfil.nomeCompleto,
        // O tipo vai separado do arquivo: e ele que escolhe o ramo de envio
        // no n8n e o formato gravado na conversa.
        tipo: midia ? midia.tipo : "texto",
        ...(midia ? { base64: midia.base64 } : {}),
      }),
      signal: AbortSignal.timeout(LIMITE_DE_ESPERA),
    });
  } catch {
    // Rede, DNS ou estouro de tempo. Não dá para saber se a mensagem saiu,
    // então o texto diz isso em vez de afirmar que falhou.
    return recusar(
      "Não deu para falar com o serviço de envio. Confira no WhatsApp antes de reenviar.",
      502,
    );
  }

  if (!resposta.ok) {
    return recusar(
      `O serviço de envio recusou (HTTP ${resposta.status}).`,
      502,
    );
  }

  const resultado = (await resposta.json().catch(() => null)) as {
    enviada?: boolean;
    motivo?: string;
  } | null;

  if (!resultado?.enviada) {
    return recusar(resultado?.motivo ?? "A mensagem não foi enviada.", 422);
  }

  return NextResponse.json({ enviada: true, autor: perfil.nomeCompleto });
}
