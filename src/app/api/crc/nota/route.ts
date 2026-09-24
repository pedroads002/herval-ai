import { NextResponse } from "next/server";
import { carregarPerfil } from "@/lib/perfil";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

/**
 * Grava uma nota interna do CRC sobre o lead.
 *
 * **O autor não vem do formulário.** O navegador manda só o lead e o texto; o
 * nome e o id de quem assina saem da sessão do Supabase, aqui no servidor —
 * o mesmo cuidado que a rota de envio já toma.
 *
 * Por que isso importa mesmo existindo RLS: a política da tabela compara
 * `auth.uid() = autor_id`, então o *id* já é impossível de forjar. Mas
 * `autor_nome` é texto livre, e é ele que aparece na tela. Sem o servidor
 * preenchendo os dois, um cliente adulterado gravaria a nota com o id certo e
 * o nome de outra pessoa — e a assinatura que o CRC lê seria mentira com o
 * banco inteiro consistente.
 *
 * A gravação usa o cliente da sessão (e não uma chave de serviço) de
 * propósito: assim a RLS continua valendo de verdade, em vez de ser
 * contornada por um caminho privilegiado que confia só neste arquivo.
 */

type Pedido = { leadId?: unknown; texto?: unknown };

/** Nota é registro, não redação. O limite evita colar um documento inteiro. */
const LIMITE_DE_TEXTO = 2000;

function recusar(motivo: string, status: number) {
  return NextResponse.json({ salva: false, motivo }, { status });
}

export async function POST(request: Request) {
  if (!supabaseConfigurado()) {
    return recusar("O Supabase não está configurado neste ambiente.", 503);
  }

  const perfil = await carregarPerfil();
  if (!perfil) {
    return recusar("Sua sessão expirou. Entre de novo para salvar a nota.", 401);
  }

  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  const usuario = data.user;
  if (!usuario) {
    return recusar("Sua sessão expirou. Entre de novo para salvar a nota.", 401);
  }

  let pedido: Pedido;
  try {
    pedido = (await request.json()) as Pedido;
  } catch {
    return recusar("Pedido malformado.", 400);
  }

  const leadId = Number(pedido.leadId);
  const texto = String(pedido.texto ?? "").trim();

  if (!Number.isInteger(leadId) || leadId <= 0) {
    return recusar("Lead inválido.", 400);
  }
  if (texto === "") {
    return recusar("A nota está vazia.", 400);
  }
  if (texto.length > LIMITE_DE_TEXTO) {
    return recusar(
      `A nota passou de ${LIMITE_DE_TEXTO} caracteres. Guarde o essencial aqui.`,
      400,
    );
  }

  const { data: gravada, error } = await supabase
    .from("notas")
    .insert({
      lead_id: leadId,
      autor_id: usuario.id,
      autor_nome: perfil.nomeCompleto,
      texto,
    })
    .select("id, autor_nome, texto, criado_em")
    .single();

  if (error) {
    // A chave estrangeira barra nota em lead que não existe — o caso de quem
    // chega pelo Funil, que ainda usa dado de exemplo. Vale dizer isso em
    // português, porque é o erro mais provável de aparecer agora.
    const motivo =
      error.code === "23503"
        ? "Este lead não está no banco, então não há onde guardar a nota."
        : `Não deu para salvar a nota: ${error.message}`;
    return recusar(motivo, 422);
  }

  return NextResponse.json({
    salva: true,
    nota: {
      id: gravada.id,
      leadId,
      autor: gravada.autor_nome,
      texto: gravada.texto,
      minutosAtras: 0,
    },
  });
}
