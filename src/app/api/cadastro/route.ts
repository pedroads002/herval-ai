import { createClient } from "@supabase/supabase-js";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { supabaseUrl, supabaseChaveAnon } from "@/lib/supabase/config";
import { PAPEIS } from "@/lib/autorizacao";
import { normalizarDocumento, validarCpfCnpj } from "@/lib/documento";

/**
 * Cadastro self-service do cliente (clínica, profissional, especialista —
 * quem já contratou a Herval e só precisa de acesso ao que já é dele).
 *
 * Esta rota, assim como `provisionar-cliente`, NÃO cria clínica — a clínica
 * já existe, cadastrada pela Herval com todos os campos de negócio (ver
 * comentário daquela rota). A diferença é só quem aperta o botão: lá é a
 * Herval escolhendo a clínica da lista; aqui é a própria pessoa, e por isso
 * o documento (CPF/CNPJ) faz o papel que lá era a escolha manual — é como a
 * rota encontra a clínica certa sem pedir confiança em mais nada que vem do
 * corpo do pedido.
 *
 * Não existe aprovação nem plano/pagamento aqui de propósito: quem já tem
 * CNPJ/CPF cadastrado em `clinicas` já é cliente pagante da agência (decisão
 * comercial, tomada fora deste código) — este formulário só liga a pessoa a
 * esse acesso que já é dela. Documento sem clínica correspondente é
 * recusado (fail-closed): ninguém cria o próprio acesso do nada.
 *
 * Pública de propósito (sem `carregarAutorizacao()`) — é o único jeito de um
 * cliente novo, que ainda não tem sessão nenhuma, conseguir criar a conta.
 */

type Corpo = {
  nomeCompleto?: unknown;
  email?: unknown;
  cpfCnpj?: unknown;
  senha?: unknown;
  confirmarSenha?: unknown;
};

function recusar(motivo: string, status: number) {
  return Response.json({ ok: false, motivo }, { status });
}

const EMAIL_RAZOAVEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) {
    return recusar(
      "Cadastro não está configurado neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY).",
      503,
    );
  }

  const corpo = (await request.json().catch(() => null)) as Corpo | null;
  if (!corpo) return recusar("Corpo do pedido inválido.", 400);

  const nomeCompleto =
    typeof corpo.nomeCompleto === "string" ? corpo.nomeCompleto.trim() : "";
  if (nomeCompleto.length < 3) {
    return recusar("Informe o nome completo.", 400);
  }

  const email = typeof corpo.email === "string" ? corpo.email.trim() : "";
  if (!EMAIL_RAZOAVEL.test(email)) {
    return recusar("E-mail inválido.", 400);
  }

  const cpfCnpj =
    typeof corpo.cpfCnpj === "string" ? normalizarDocumento(corpo.cpfCnpj) : "";
  if (!validarCpfCnpj(cpfCnpj)) {
    return recusar("CPF ou CNPJ inválido.", 400);
  }

  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  const confirmarSenha =
    typeof corpo.confirmarSenha === "string" ? corpo.confirmarSenha : "";
  if (senha.length < 8) {
    return recusar("A senha precisa ter pelo menos 8 caracteres.", 400);
  }
  if (senha !== confirmarSenha) {
    return recusar("As senhas não conferem.", 400);
  }

  const { data: clinica, error: erroDaClinica } = await clienteAdmin
    .from("clinicas")
    .select("id, nome")
    .eq("cpf_cnpj", cpfCnpj)
    .maybeSingle();

  if (erroDaClinica || !clinica) {
    return recusar(
      "CPF/CNPJ não encontrado em nosso cadastro de clientes. Fale com a Herval para liberar seu acesso.",
      404,
    );
  }

  const origem = request.headers.get("origin") ?? new URL(request.url).origin;

  // Usa a chave pública (anon) para o signUp em si — é o endpoint público
  // normal do Supabase Auth, o mesmo que o navegador chamaria. A service_role
  // (clienteAdmin) fica só para as partes privilegiadas: achar a clínica,
  // atualizar o perfil e gravar a autorização.
  const supabaseAuth = createClient(supabaseUrl, supabaseChaveAnon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: cadastro, error: erroDoCadastro } = await supabaseAuth.auth.signUp({
    email,
    password: senha,
    options: { emailRedirectTo: `${origem}/login` },
  });

  // Supabase devolve um usuário "vazio" (sem identities) em vez de erro
  // quando o e-mail já existe, para não revelar isso a quem só está
  // tentando adivinhar e-mails cadastrados. Tratamos os dois casos juntos.
  const jaCadastrado =
    erroDoCadastro?.message?.includes("already registered") ||
    (cadastro?.user && cadastro.user.identities?.length === 0);

  if (jaCadastrado) {
    return recusar("Este e-mail já tem conta no sistema.", 409);
  }

  if (erroDoCadastro || !cadastro?.user) {
    return recusar("Não deu para criar a conta. Tente novamente.", 500);
  }

  const usuarioId = cadastro.user.id;
  const [nome, ...resto] = nomeCompleto.split(/\s+/);
  const sobrenome = resto.join(" ");

  await clienteAdmin.from("profiles").update({ nome, sobrenome }).eq("id", usuarioId);

  // Primeiro cadastro da clínica vira cliente_admin; os próximos (outro
  // profissional da mesma clínica se cadastrando depois) entram como
  // cliente_operacional. Ajustável depois se a Herval quiser outro critério.
  const { count } = await clienteAdmin
    .from("autorizacoes")
    .select("usuario_id", { count: "exact", head: true })
    .eq("clinica_id", clinica.id);

  const papel = count && count > 0 ? PAPEIS.CLIENTE_OPERACIONAL : PAPEIS.CLIENTE_ADMIN;

  const { error: erroDaAutorizacao } = await clienteAdmin.from("autorizacoes").insert({
    usuario_id: usuarioId,
    papel,
    clinica_id: clinica.id,
    criado_por: null,
  });

  if (erroDaAutorizacao) {
    await clienteAdmin.auth.admin.deleteUser(usuarioId).catch(() => {});
    return recusar("Não deu para concluir o cadastro. Nada foi criado.", 500);
  }

  return Response.json({ ok: true, clinica: clinica.nome });
}
