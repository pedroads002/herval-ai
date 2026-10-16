import {
  carregarAutorizacao,
  ehHervalAdmin,
  PAPEIS,
} from "@/lib/autorizacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  gerarCodigoDeAcesso,
  gerarSal,
  gerarToken,
  hashDoCodigo,
  expiraEm,
} from "@/lib/convites";

/**
 * Gera o convite de autocadastro de alguém que vai entrar numa clínica que já
 * existe em `clinicas`.
 *
 * Duas portas, mesma rota — por isso nunca foi reaberta quando chegou a fase
 * do convite de colaborador:
 *
 * - A Herval (`herval_admin`) convida qualquer clínica, em qualquer papel
 *   (`cliente_admin`, o contato principal, ou `cliente_operacional`). É o
 *   botão "Convidar cliente" na tela de Clientes.
 * - Quem já é `cliente_admin` de uma clínica convida só PARA a própria
 *   clínica, e só como `cliente_operacional` — ela não escolhe a clínica
 *   (`clinicaId` do corpo é ignorado; a de verdade é a da própria sessão) nem
 *   o papel (sempre colaborador, nunca outro admin). É o botão em Equipe.
 *
 * A rota não cria clínica nem profissional — isso é formulário próprio — e,
 * por enquanto, não cria nada em `autorizacoes` também: só depois que a
 * pessoa completar o próprio cadastro em `/convite/[token]` é que a conta
 * nasce. Até lá, nada muda para ninguém.
 *
 * Dois textos voltam na resposta e não são gravados em lugar nenhum: o link
 * e o código de acesso. É a única vez que o código existe por fora do hash —
 * depois deste retorno, só quem mandou o convite (por fora deste sistema)
 * sabe qual é.
 */

type Corpo = {
  clinicaId?: unknown;
  papel?: unknown;
};

function recusar(motivo: string, status: number) {
  return Response.json({ ok: false, motivo }, { status });
}

export async function POST(request: Request) {
  const autorizacao = await carregarAutorizacao();
  if (!autorizacao) return recusar("Sessão expirada.", 401);

  const souHervalAdmin = ehHervalAdmin(autorizacao);
  const souClienteAdmin =
    autorizacao.autorizado && autorizacao.papel === PAPEIS.CLIENTE_ADMIN;

  if (!souHervalAdmin && !souClienteAdmin) {
    return recusar("Acesso não autorizado.", 403);
  }

  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) {
    return recusar(
      "Convite não está configurado neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY).",
      503,
    );
  }

  const corpo = ((await request.json().catch(() => ({}))) ?? {}) as Corpo;

  // Herval escolhe a clínica pelo corpo do pedido; cliente_admin não escolhe
  // nada — a clínica é sempre a da própria sessão, nunca a que vier no corpo
  // (confiar nisso deixaria uma clínica convidar gente para outra).
  const clinicaId = souHervalAdmin
    ? Number(corpo.clinicaId)
    : autorizacao.operacaoId;

  if (!Number.isInteger(clinicaId) || clinicaId === null || clinicaId <= 0) {
    return recusar("Clínica inválida.", 400);
  }

  // Mesma regra: só a Herval decide o papel de quem está convidando. Convite
  // de colaborador — gerado pelo próprio cliente_admin — é sempre
  // cliente_operacional; ela não cria outro admin por conta própria.
  const papel = souHervalAdmin
    ? corpo.papel === undefined
      ? PAPEIS.CLIENTE_ADMIN
      : corpo.papel
    : PAPEIS.CLIENTE_OPERACIONAL;

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

  // Um convite pendente por clínica. Gerar um novo aposenta o anterior — sem
  // isso, um código antigo esquecido continuaria valendo ao lado do novo, e
  // quem olhasse a clínica não teria como saber qual dos dois ainda vale.
  await clienteAdmin
    .from("convites")
    .update({ expira_em: new Date().toISOString() })
    .eq("clinica_id", clinicaId)
    .is("usado_em", null);

  const token = gerarToken();
  const codigo = gerarCodigoDeAcesso();
  const sal = gerarSal();
  const validade = expiraEm();

  const { error: erroDoConvite } = await clienteAdmin.from("convites").insert({
    token,
    clinica_id: clinicaId,
    papel,
    codigo_hash: hashDoCodigo(codigo, sal),
    codigo_sal: sal,
    criado_por: autorizacao.usuarioId,
    expira_em: validade,
  });

  if (erroDoConvite) {
    return recusar("Não deu para gerar o convite. Nada foi criado.", 500);
  }

  const origem = new URL(request.url).origin;

  return Response.json({
    ok: true,
    clinica: clinica.nome,
    link: `${origem}/convite/${token}`,
    codigoAcesso: codigo,
    expiraEm: validade,
  });
}
