import { randomUUID } from "node:crypto";
import { carregarAutorizacao, ehHervalAdmin } from "@/lib/autorizacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { FormatoDeMensagem } from "@/data/templates";

/**
 * Sobe o arquivo de uma mensagem de template (áudio, imagem ou vídeo) e
 * devolve o endereço público para a tela gravar em `template_mensagens.midia_url`.
 *
 * **Por que a sessão do próprio usuário não basta** (a pergunta que
 * `lib/supabase/admin.ts` manda responder antes de importar dali): o bucket
 * `clinicas-midia` é público para leitura, mas `storage.objects` está com RLS
 * ligado e **sem política nenhuma**. Quem está logado não consegue gravar
 * arquivo lá — o que existe hoje no bucket subiu pelo painel do Supabase ou
 * pelo n8n. Subir pela sessão exigiria criar política nova de storage, e a
 * decisão (05/11/2026) foi não mexer no banco: o upload passa pela
 * `service_role`, como as outras rotas de `api/admin`, atrás da mesma tranca
 * de papel.
 *
 * O que é conferido, em ordem: papel `herval_admin`; o template existe (e é
 * dele que sai a clínica do caminho — a tela não escolhe a pasta); o formato
 * é um dos três que levam arquivo; o tipo do arquivo combina com o formato; e
 * o tamanho cabe no que o WhatsApp aceita.
 *
 * **O arquivo fica legível por qualquer um que tenha o endereço**, porque o
 * bucket é público — é o mesmo bucket que as fotos de clínica já usam. Serve
 * para material de divulgação, que é o que um template manda; não é lugar de
 * documento de paciente.
 */

/** 16 MB: o teto do WhatsApp para áudio e vídeo. Imagem cabe de sobra. */
const TAMANHO_MAXIMO = 16 * 1024 * 1024;

const BUCKET = "clinicas-midia";

/**
 * O que cada formato aceita receber.
 *
 * Lista fechada de propósito: o que entra aqui vai parar no celular de um
 * paciente, e o WhatsApp não manda formato que não conhece.
 */
const TIPOS_POR_FORMATO: Record<string, string[]> = {
  audio: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/aac", "audio/amr"],
  imagem: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/3gpp", "video/quicktime"],
};

function recusar(motivo: string, status: number) {
  return Response.json({ ok: false, motivo }, { status });
}

/**
 * O nome do arquivo, limpo para virar parte de um endereço.
 *
 * O nome original fica visível na URL de propósito: ajuda a reconhecer o
 * arquivo depois, no painel do Supabase. O que ele não pode fazer é mudar de
 * pasta nem carregar caractere que quebre o endereço, então sobra só letra,
 * número, ponto, hífen e sublinhado.
 */
function nomeLimpo(nome: string) {
  const semCaminho = nome.split(/[\\/]/).pop() ?? "arquivo";

  const limpo = semCaminho
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(0, 80);

  return limpo === "" ? "arquivo" : limpo;
}

export async function POST(request: Request) {
  const autorizacao = await carregarAutorizacao();
  if (!autorizacao) return recusar("Sessão expirada.", 401);
  if (!ehHervalAdmin(autorizacao))
    return recusar("Acesso não autorizado.", 403);

  if (!supabaseConfigurado()) {
    return recusar("O Supabase não está configurado neste ambiente.", 503);
  }

  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) {
    return recusar(
      "O envio de arquivo não está configurado neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY).",
      503,
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return recusar("Envio inválido.", 400);

  const templateId = Number(String(formData.get("template_id") ?? "").trim());
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return recusar("Template inválido.", 400);
  }

  const formato = String(formData.get("formato") ?? "").trim();
  const tiposAceitos = TIPOS_POR_FORMATO[formato];
  if (!tiposAceitos) {
    return recusar("Este formato de mensagem não leva arquivo.", 400);
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return recusar("Escolha um arquivo.", 400);
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return recusar(
      `O arquivo tem ${Math.ceil(arquivo.size / (1024 * 1024))} MB e o limite é ${TAMANHO_MAXIMO / (1024 * 1024)} MB.`,
      413,
    );
  }
  if (!tiposAceitos.includes(arquivo.type)) {
    return recusar(
      `Este arquivo (${arquivo.type || "tipo desconhecido"}) não serve como ${formato}.`,
      415,
    );
  }

  // A clínica do caminho sai do banco, não do que a tela mandou: assim um id
  // de template de um cliente nunca escreve na pasta de outro.
  const supabase = await criarClienteServidor();
  const { data: template, error: erroDoTemplate } = await supabase
    .from("templates")
    .select("id, clinica_id")
    .eq("id", templateId)
    .maybeSingle();

  if (erroDoTemplate) return recusar("Não deu para conferir o template.", 500);
  if (!template) return recusar("Template não encontrado.", 404);

  const caminho = `templates/${template.clinica_id}/${template.id}/${randomUUID()}-${nomeLimpo(arquivo.name)}`;

  const { error: erroDoUpload } = await clienteAdmin.storage
    .from(BUCKET)
    .upload(caminho, arquivo, {
      contentType: arquivo.type,
      // Caminho novo a cada envio, pelo uuid: `upsert` ligado só esconderia
      // uma colisão que não devia acontecer.
      upsert: false,
    });

  if (erroDoUpload) {
    return recusar(
      `Não deu para enviar o arquivo: ${erroDoUpload.message}`,
      502,
    );
  }

  const {
    data: { publicUrl },
  } = clienteAdmin.storage.from(BUCKET).getPublicUrl(caminho);

  return Response.json({
    ok: true,
    url: publicUrl,
    formato: formato as FormatoDeMensagem,
  });
}
