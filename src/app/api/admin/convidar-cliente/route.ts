import { carregarAutorizacao, ehHervalAdmin, PAPEIS } from "@/lib/autorizacao";
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
 * Gera o convite de autocadastro de um cliente que já existe em `clinicas`.
 *
 * O botão "Convidar cliente" (tela do cliente, em Clientes) chama esta rota.
 * Ela não cria clínica nem profissional — isso é formulário próprio, na
 * mesma tela — e, por enquanto, não cria nada em `autorizacoes` também: só
 * depois que o cliente completar o próprio cadastro em `/convite/[token]` é
 * que a conta nasce. Até lá, nada muda para ninguém.
 *
 * Dois textos voltam na resposta e não são gravados em lugar nenhum: o link
 * e o código de acesso. É a única vez que o código existe por fora do hash —
 * depois deste retorno, só quem a Herval mandou para o cliente (por fora
 * deste sistema) sabe qual é.
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

  if (!ehHervalAdmin(autorizacao)) {
    return recusar("Acesso não autorizado.", 403);
  }

  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) {
    return recusar(
      "Convite não está configurado neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY).",
      503,
    );
  }

  const corpo = (await request.json().catch(() => null)) as Corpo | null;
  if (!corpo) return recusar("Corpo do pedido inválido.", 400);

  const clinicaId = Number(corpo.clinicaId);
  if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
    return recusar("Clínica inválida.", 400);
  }

  // O botão de hoje só convida o contato principal. Operacional já está na
  // lista porque é o mesmo papel que o convite de colaborador vai usar —
  // sem reabrir esta rota quando essa fase chegar.
  const papel =
    corpo.papel === undefined ? PAPEIS.CLIENTE_ADMIN : corpo.papel;
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
