import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

/**
 * Quem é a pessoa logada dentro do negócio, e de qual operação.
 *
 * Isto é uma camada NOVA, ao lado do que já existe. O `exigirSessao()` das
 * ações de servidor e o `carregarPerfil()` do cabeçalho continuam intactos e
 * continuam decidindo o que decidem hoje — nenhuma tela chama este arquivo
 * ainda. A integração acontece por fase, nas próximas etapas, e não de uma vez.
 *
 * A fonte é sempre a tabela `public.autorizacoes`, lida no servidor com a
 * sessão do próprio usuário. Nunca o navegador, nunca o `user_metadata` (que o
 * usuário pode editar), nunca a URL. Papel e operação que chegam da tela são
 * pedido, não prova.
 */

/**
 * Os três papéis. Os nomes em maiúscula são o vocabulário do projeto; o valor
 * minúsculo é o que está guardado no banco, na mesma forma de
 * `clinicas.tipo_operacao`.
 */
export const PAPEIS = {
  HERVAL_ADMIN: "herval_admin",
  CLIENTE_ADMIN: "cliente_admin",
  CLIENTE_OPERACIONAL: "cliente_operacional",
} as const;

export type Papel = (typeof PAPEIS)[keyof typeof PAPEIS];

export type Autorizacao = {
  usuarioId: string;
  nome: string;
  /** `null` quando não existe autorização, ou quando ela está desativada. */
  papel: Papel | null;
  /** Sempre `null` para a Herval: acesso global não é vínculo com clínica. */
  operacaoId: number | null;
  /**
   * O resumo em que as próximas fases vão se apoiar. Falso é o padrão: sem
   * linha, com linha desativada, com papel desconhecido ou com erro de
   * leitura, a resposta é "não autorizado" — nunca "administrador".
   */
  autorizado: boolean;
};

function ehPapelConhecido(valor: unknown): valor is Papel {
  return (Object.values(PAPEIS) as unknown[]).includes(valor);
}

/**
 * O usuário logado sem nenhuma autorização. Existe para que o caminho de
 * negativa seja um só, escrito uma vez, e não uma montagem de objeto repetida
 * em cada saída de erro — onde um campo esquecido viraria um privilégio.
 */
function semAutorizacao(usuarioId: string, nome: string): Autorizacao {
  return { usuarioId, nome, papel: null, operacaoId: null, autorizado: false };
}

/**
 * Resolve o contexto de autorização da sessão atual.
 *
 * Devolve `null` apenas quando não há sessão nenhuma (ou o Supabase não está
 * configurado) — ou seja, quando a pergunta "quem é" não tem sujeito. Usuário
 * logado sem autorização devolve objeto com `autorizado: false`, porque é uma
 * resposta diferente de "não tem ninguém aqui".
 *
 * Não chama `carregarPerfil()` de propósito: precisa do id cru do usuário e de
 * uma só ida ao `getUser()`.
 */
export async function carregarAutorizacao(): Promise<Autorizacao | null> {
  if (!supabaseConfigurado()) return null;

  const supabase = await criarClienteServidor();

  const user = await supabase.auth
    .getUser()
    .then(({ data }) => data.user)
    .catch(() => null);

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nome, sobrenome")
    .eq("id", user.id)
    .maybeSingle();

  const nome =
    [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(" ").trim() ||
    user.email ||
    "";

  // O filtro por `usuario_id` é redundante com a política da tabela, e é
  // assim que tem que ser: se um dia a política mudar, o código continua
  // pedindo só a própria linha.
  const { data: registro, error } = await supabase
    .from("autorizacoes")
    .select("papel, clinica_id, ativo")
    .eq("usuario_id", user.id)
    .maybeSingle();

  // Erro de leitura é negativa, não exceção: a tela não deve quebrar, e o
  // usuário não deve ser promovido por um banco fora do ar.
  if (error || !registro) return semAutorizacao(user.id, nome);

  if (!registro.ativo) return semAutorizacao(user.id, nome);
  if (!ehPapelConhecido(registro.papel)) return semAutorizacao(user.id, nome);

  // A coerência entre papel e operação é garantida por CHECK no banco. A
  // conferência aqui é a segunda tranca, para o caso de alguém escrever a
  // linha por um caminho que o CHECK não cubra no futuro.
  const operacaoId =
    typeof registro.clinica_id === "number" ? registro.clinica_id : null;

  if (registro.papel === PAPEIS.HERVAL_ADMIN) {
    if (operacaoId !== null) return semAutorizacao(user.id, nome);
    return {
      usuarioId: user.id,
      nome,
      papel: PAPEIS.HERVAL_ADMIN,
      operacaoId: null,
      autorizado: true,
    };
  }

  if (operacaoId === null) return semAutorizacao(user.id, nome);

  return {
    usuarioId: user.id,
    nome,
    papel: registro.papel,
    operacaoId,
    autorizado: true,
  };
}

/** Acesso global da Herval. */
export function ehHervalAdmin(autorizacao: Autorizacao | null): boolean {
  return (
    autorizacao?.autorizado === true &&
    autorizacao.papel === PAPEIS.HERVAL_ADMIN
  );
}

/** Usuário de cliente, de qualquer um dos dois papéis. */
export function ehCliente(autorizacao: Autorizacao | null): boolean {
  if (autorizacao?.autorizado !== true) return false;
  return (
    autorizacao.papel === PAPEIS.CLIENTE_ADMIN ||
    autorizacao.papel === PAPEIS.CLIENTE_OPERACIONAL
  );
}

/**
 * A operação que o usuário pode ver, quando ele é de cliente.
 *
 * `null` para a Herval (vê todas) e `null` para quem não tem autorização (não
 * vê nenhuma) — são respostas diferentes com o mesmo valor, e por isso quem
 * chamar precisa olhar o papel antes de usar este número como filtro. É
 * exatamente a confusão que as próximas fases têm que evitar.
 */
export function operacaoDoUsuario(
  autorizacao: Autorizacao | null,
): number | null {
  if (!autorizacao || !ehCliente(autorizacao)) return null;
  return autorizacao.operacaoId;
}
