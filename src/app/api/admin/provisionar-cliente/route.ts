import { carregarAutorizacao, ehHervalAdmin, PAPEIS } from "@/lib/autorizacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/**
 * Dar acesso de login a um cliente já cadastrado em `clinicas`.
 *
 * Esta rota NÃO cria clínica — isso já existe na tela `Clientes`, com todos
 * os campos do negócio, e duplicar esse cadastro aqui criaria dois jeitos de
 * fazer a mesma coisa. O que falta hoje, e é só isso que esta rota resolve, é
 * a ponte entre uma clínica que já existe e uma pessoa conseguindo entrar no
 * painel como ela: criar o usuário no Supabase Auth e a linha em
 * `autorizacoes` que aponta pra essa clínica.
 *
 * Só a Herval acessa. O comentário de `autorizacoes.sql` (item 3) registra a
 * decisão de que ninguém se promove e que a tabela não tem política de
 * escrita nenhuma — esta rota não contradiz isso: ela não dá ao navegador um
 * jeito de escrever em `autorizacoes` diretamente, e sim um endpoint que, do
 * lado de dentro, confere `ehHervalAdmin()` antes de qualquer linha, e é o
 * único lugar do projeto com a `service_role` (ver `lib/supabase/admin.ts`).
 * Continua sendo a Herval quem decide — só deixou de ser manual.
 *
 * Nunca cria `herval_admin` por aqui: esse papel continua sendo decisão de
 * quem administra o banco diretamente, não um valor que chega pelo corpo do
 * pedido.
 */

type Corpo = {
  clinicaId?: unknown;
  email?: unknown;
  papel?: unknown;
};

function recusar(motivo: string, status: number) {
  return Response.json({ ok: false, motivo }, { status });
}

const EMAIL_RAZOAVEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const autorizacao = await carregarAutorizacao();
  if (!autorizacao) return recusar("Sessão expirada.", 401);

  if (!ehHervalAdmin(autorizacao)) {
    return recusar("Acesso não autorizado.", 403);
  }

  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) {
    return recusar(
      "Provisionamento não está configurado neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY).",
      503,
    );
  }

  const corpo = (await request.json().catch(() => null)) as Corpo | null;
  if (!corpo) return recusar("Corpo do pedido inválido.", 400);

  const clinicaId = Number(corpo.clinicaId);
  if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
    return recusar("Clínica inválida.", 400);
  }

  const email = typeof corpo.email === "string" ? corpo.email.trim() : "";
  if (!EMAIL_RAZOAVEL.test(email)) {
    return recusar("E-mail inválido.", 400);
  }

  const papel = corpo.papel;
  if (papel !== PAPEIS.CLIENTE_ADMIN && papel !== PAPEIS.CLIENTE_OPERACIONAL) {
    return recusar(
      "Papel inválido. Use 'cliente_admin' ou 'cliente_operacional'.",
      400,
    );
  }

  const supabase = await criarClienteServidor();
  const { data: clinica, error: erroDaClinica } = await supabase
    .from("clinicas")
    .select("id, nome")
    .eq("id", clinicaId)
    .maybeSingle();

  if (erroDaClinica || !clinica) {
    return recusar("Clínica não encontrada.", 404);
  }

  const { data: convite, error: erroDoConvite } =
    await clienteAdmin.auth.admin.inviteUserByEmail(email);

  if (erroDoConvite || !convite?.user) {
    return recusar(
      erroDoConvite?.message?.includes("already been registered")
        ? "Este e-mail já tem conta no sistema."
        : "Não deu para criar o usuário.",
      409,
    );
  }

  const usuarioId = convite.user.id;

  const { error: erroDaAutorizacao } = await clienteAdmin
    .from("autorizacoes")
    .insert({
      usuario_id: usuarioId,
      papel,
      clinica_id: clinicaId,
      criado_por: autorizacao.usuarioId,
    });

  if (erroDaAutorizacao) {
    await clienteAdmin.auth.admin.deleteUser(usuarioId).catch(() => {});
    return recusar("Não deu para registrar a autorização. Nada foi criado.", 500);
  }

  return Response.json({
    ok: true,
    usuarioId,
    clinica: clinica.nome,
    papel,
  });
}
