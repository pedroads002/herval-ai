import { carregarAutorizacao, PAPEIS } from "@/lib/autorizacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Salva quais das quatro telas opcionais (Leads, Conversas, Relatórios,
 * Agenda) um colaborador da própria clínica pode abrir.
 *
 * Só `cliente_admin` chama esta rota — é o mesmo papel que convida pela tela
 * de Equipe, nunca `herval_admin` (a granularidade é decisão da clínica sobre
 * a própria equipe, não da Herval sobre a clínica) nem o próprio colaborador
 * (ele não se autopromove). A linha alvo precisa, ao mesmo tempo: existir,
 * estar ativa, ser `cliente_operacional`, e pertencer à MESMA clínica de
 * quem está chamando — sem isso um `cliente_admin` poderia mexer na equipe de
 * outra clínica só sabendo o id de alguém.
 *
 * `telas: []` é válido e tem significado — "nenhuma tela opcional, só Visão
 * Geral" — não é tratado como "nada para salvar". As quatro marcadas juntas
 * são gravadas como `null` ("sem restrição"), para que uma quinta tela, se um
 * dia existir, já nasça liberada para quem hoje tem acesso total.
 */

const TELAS_VALIDAS = new Set(["funil", "atendimento", "relatorios", "agenda"]);

type Corpo = {
  usuarioId?: unknown;
  telas?: unknown;
};

function recusar(motivo: string, status: number) {
  return Response.json({ ok: false, motivo }, { status });
}

export async function POST(request: Request) {
  const autorizacao = await carregarAutorizacao();
  if (!autorizacao) return recusar("Sessão expirada.", 401);

  if (!autorizacao.autorizado || autorizacao.papel !== PAPEIS.CLIENTE_ADMIN) {
    return recusar("Acesso não autorizado.", 403);
  }

  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) {
    return recusar(
      "Permissões não estão configuradas neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY).",
      503,
    );
  }

  const corpo = ((await request.json().catch(() => ({}))) ?? {}) as Corpo;

  const usuarioId = typeof corpo.usuarioId === "string" ? corpo.usuarioId : "";
  if (usuarioId === "") return recusar("Colaborador inválido.", 400);

  if (
    !Array.isArray(corpo.telas) ||
    !corpo.telas.every((tela) => typeof tela === "string")
  ) {
    return recusar("Lista de telas inválida.", 400);
  }

  const telas = [...new Set(corpo.telas as string[])];
  if (!telas.every((tela) => TELAS_VALIDAS.has(tela))) {
    return recusar("Lista de telas inválida.", 400);
  }

  // A linha alvo precisa ser colaborador ativo da MESMA clínica de quem está
  // chamando — nunca confia em `usuarioId` por si só.
  const { data: linhaAlvo, error: erroDaLinha } = await clienteAdmin
    .from("autorizacoes")
    .select("clinica_id, papel, ativo")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (erroDaLinha || !linhaAlvo) return recusar("Colaborador não encontrado.", 404);
  if (!linhaAlvo.ativo || linhaAlvo.papel !== PAPEIS.CLIENTE_OPERACIONAL) {
    return recusar("Este acesso não é de um colaborador.", 409);
  }
  if (linhaAlvo.clinica_id !== autorizacao.operacaoId) {
    return recusar("Este colaborador não é da sua clínica.", 403);
  }

  // Todas as quatro marcadas é o mesmo que "sem restrição" — ver o
  // comentário no topo do arquivo.
  const paraGravar = telas.length === TELAS_VALIDAS.size ? null : telas;

  const { error: erroDoUpdate } = await clienteAdmin
    .from("autorizacoes")
    .update({ telas_permitidas: paraGravar, atualizado_em: new Date().toISOString() })
    .eq("usuario_id", usuarioId);

  if (erroDoUpdate) {
    return recusar("Não deu para salvar as permissões. Tente de novo.", 500);
  }

  return Response.json({ ok: true, telasPermitidas: paraGravar });
}
