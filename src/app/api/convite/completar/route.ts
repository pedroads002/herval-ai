import { createClient } from "@supabase/supabase-js";
import { supabaseChaveAnon, supabaseUrl } from "@/lib/supabase/config";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import {
  codigoCorreto,
  dentroDoLimiteDeTentativas,
  TENTATIVAS_MAXIMAS_DO_CODIGO,
} from "@/lib/convites";
import { validarCpfCnpj, normalizarDocumento } from "@/lib/documento";

/**
 * Conclui o autocadastro: confere o convite, cria a conta e devolve o
 * "confirme seu e-mail" do próprio Supabase.
 *
 * Rota pública — quem chama ainda não tem conta, então não há sessão para
 * conferir. A tranca inteira está no convite: token que exista, não usado,
 * não expirado, e o código de acesso certo. Qualquer uma dessas falhando, a
 * rota recusa antes de tocar em `auth.users`.
 *
 * `auth.signUp` (cliente comum, não `service_role`) é de propósito: é o
 * único caminho que faz o Supabase mandar o e-mail de confirmação dele
 * mesmo. Criar o usuário por `admin.createUser` sem esse e-mail contrariaria
 * o pedido — "só clicando no link de confirmação o cliente consegue entrar".
 */

const EMAIL_RAZOAVEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Corpo = {
  token?: unknown;
  nomeCompleto?: unknown;
  email?: unknown;
  cpfCnpj?: unknown;
  codigoAcesso?: unknown;
  senha?: unknown;
};

function recusar(motivo: string, status: number) {
  return Response.json({ ok: false, motivo }, { status });
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

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

  const token = texto(corpo.token);
  const nomeCompleto = texto(corpo.nomeCompleto);
  const email = texto(corpo.email).toLowerCase();
  const cpfCnpj = normalizarDocumento(texto(corpo.cpfCnpj));
  const codigoAcesso = texto(corpo.codigoAcesso);
  const senha = texto(corpo.senha);

  if (token === "") return recusar("Convite inválido.", 400);
  if (nomeCompleto === "") return recusar("Informe o nome completo.", 400);
  if (!EMAIL_RAZOAVEL.test(email)) return recusar("E-mail inválido.", 400);
  if (!validarCpfCnpj(cpfCnpj)) return recusar("CPF ou CNPJ inválido.", 400);
  if (codigoAcesso === "") return recusar("Informe o código de acesso.", 400);
  if (senha.length < 8) {
    return recusar("A senha precisa ter pelo menos 8 caracteres.", 400);
  }

  const { data: convite, error: erroDoConvite } = await clienteAdmin
    .from("convites")
    .select("clinica_id, papel, codigo_hash, codigo_sal, tentativas, usado_em, expira_em")
    .eq("token", token)
    .maybeSingle();

  if (erroDoConvite || !convite) return recusar("Convite não encontrado.", 404);
  if (convite.usado_em !== null) {
    return recusar("Este convite já foi usado.", 410);
  }
  if (new Date(convite.expira_em).getTime() <= Date.now()) {
    return recusar("Este convite expirou. Peça um novo à Herval.", 410);
  }
  if (!dentroDoLimiteDeTentativas(convite.tentativas)) {
    return recusar(
      "Convite bloqueado por tentativas demais. Peça um novo à Herval.",
      423,
    );
  }

  if (!codigoCorreto(codigoAcesso, convite.codigo_sal, convite.codigo_hash)) {
    const tentativas = convite.tentativas + 1;
    const bloqueado = !dentroDoLimiteDeTentativas(tentativas);

    await clienteAdmin
      .from("convites")
      .update(
        bloqueado
          ? { tentativas, expira_em: new Date().toISOString() }
          : { tentativas },
      )
      .eq("token", token);

    return recusar(
      bloqueado
        ? "Código incorreto. Convite bloqueado — peça um novo à Herval."
        : `Código de acesso incorreto. Restam ${TENTATIVAS_MAXIMAS_DO_CODIGO - tentativas} tentativa(s).`,
      401,
    );
  }

  const supabasePublico = createClient(supabaseUrl, supabaseChaveAnon);
  const origem = new URL(request.url).origin;

  const { data: cadastro, error: erroDoCadastro } = await supabasePublico.auth.signUp({
    email,
    password: senha,
    options: { emailRedirectTo: `${origem}/login` },
  });

  if (erroDoCadastro || !cadastro.user) {
    return recusar(
      erroDoCadastro?.message?.includes("already registered")
        ? "Este e-mail já tem conta no sistema. Entre, ou use 'esqueci minha senha'."
        : "Não deu para criar o cadastro. Tente de novo em instantes.",
      409,
    );
  }

  const usuarioId = cadastro.user.id;

  /**
   * `signUp` chamado de novo para o mesmo e-mail ainda não confirmado não dá
   * erro — o Supabase devolve o mesmo usuário e reenvia o e-mail. É o jeito
   * documentado de reconhecer isso: `identities` vem vazio quando o e-mail já
   * existia. Sem esta conferência, um clique duplo no botão (ou uma segunda
   * tentativa depois de uma rede instável) cairia direto no `insert` de
   * `autorizacoes` abaixo, bateria na chave primária (`usuario_id` já tem
   * linha, da primeira tentativa que deu certo) e o `desfazer` apagaria uma
   * conta que tinha acabado de nascer certinha.
   */
  const eraCadastroNovo = (cadastro.user.identities?.length ?? 0) > 0;

  if (!eraCadastroNovo) {
    const { data: jaAutorizado } = await clienteAdmin
      .from("autorizacoes")
      .select("usuario_id")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    // Primeira tentativa já tinha terminado: nada a refazer, só o e-mail de
    // confirmação que o `signUp` logo acima reenviou. Ainda assim fecha o
    // convite agora, se por algum motivo a primeira passagem não tinha
    // chegado a marcar `usado_em` — sem isso o mesmo convite continuaria
    // aceitando um e-mail diferente, criando um segundo acesso à clínica.
    if (jaAutorizado) {
      await clienteAdmin
        .from("convites")
        .update({ usado_em: new Date().toISOString(), usuario_criado: usuarioId })
        .eq("token", token)
        .is("usado_em", null);

      return Response.json({ ok: true });
    }
  }

  // `clienteAdmin` já foi conferido lá no topo, mas o TypeScript não carrega
  // essa certeza para dentro de uma função declarada depois — por isso o
  // apelido aqui, com o tipo já sem o `| null`.
  const admin = clienteAdmin;

  async function desfazer(motivo: string) {
    await admin.auth.admin.deleteUser(usuarioId).catch(() => {});
    return recusar(motivo, 500);
  }

  const { error: erroDaAutorizacao } = await clienteAdmin.from("autorizacoes").insert({
    usuario_id: usuarioId,
    papel: convite.papel,
    clinica_id: convite.clinica_id,
    criado_por: null,
  });

  if (erroDaAutorizacao) {
    return desfazer("Não deu para liberar o acesso. Nada foi criado — tente de novo.");
  }

  // O nome vem do formulário; o gatilho do banco só grava o e-mail ao criar
  // o perfil. Mesmo split de `nome`/`sobrenome` do cadastro antigo
  // (`api/cadastro`), para o perfil continuar consistente entre os dois
  // caminhos de entrada.
  const [nome, ...resto] = nomeCompleto.split(/\s+/);
  const sobrenome = resto.join(" ");
  await clienteAdmin
    .from("profiles")
    .update({ nome, sobrenome })
    .eq("id", usuarioId);

  // Só grava o CPF/CNPJ se a clínica ainda não tinha um. Quem já foi
  // cadastrado pela Herval com o documento preenchido não tem esse campo
  // sobrescrito pelo que a pessoa digitou no convite.
  await clienteAdmin
    .from("clinicas")
    .update({ cpf_cnpj: cpfCnpj })
    .eq("id", convite.clinica_id)
    .is("cpf_cnpj", null);

  const { error: erroDoConsumo } = await clienteAdmin
    .from("convites")
    .update({ usado_em: new Date().toISOString(), usuario_criado: usuarioId })
    .eq("token", token);

  if (erroDoConsumo) {
    return desfazer("Não deu para concluir o convite. Nada foi criado — tente de novo.");
  }

  return Response.json({ ok: true });
}
