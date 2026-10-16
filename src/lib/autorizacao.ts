import { redirect } from "next/navigation";
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

/**
 * As quatro telas opcionais do cliente — todas, menos Visão Geral, que todo
 * cliente sempre vê. É sobre estas quatro que o `cliente_admin` decide, por
 * colaborador, em Equipe.
 */
export const TELAS_CONTROLAVEIS = {
  FUNIL: "funil",
  ATENDIMENTO: "atendimento",
  RELATORIOS: "relatorios",
  AGENDA: "agenda",
} as const;

export type TelaControlavel =
  (typeof TELAS_CONTROLAVEIS)[keyof typeof TELAS_CONTROLAVEIS];

const TODAS_AS_TELAS_CONTROLAVEIS: readonly TelaControlavel[] = Object.values(
  TELAS_CONTROLAVEIS,
);

function ehTelaConhecida(valor: unknown): valor is TelaControlavel {
  return (TODAS_AS_TELAS_CONTROLAVEIS as readonly unknown[]).includes(valor);
}

/**
 * Lê `telas_permitidas` do banco sem confiar no formato. `null`/qualquer
 * coisa que não seja vetor volta `null` ("sem restrição"); um vetor some com
 * o que não for uma das quatro telas conhecidas, em vez de propagar lixo para
 * dentro de `Autorizacao`.
 */
function telasPermitidasValidas(bruto: unknown): TelaControlavel[] | null {
  if (!Array.isArray(bruto)) return null;
  return bruto.filter(ehTelaConhecida);
}

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
  /**
   * Só tem efeito para `cliente_operacional` — ver `telaPermitidaParaColaborador`.
   * `null` é "sem restrição configurada" (vê as quatro telas opcionais, igual
   * a hoje); vetor vazio é "nenhuma delas", de propósito.
   */
  telasPermitidas: TelaControlavel[] | null;
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
  return {
    usuarioId,
    nome,
    papel: null,
    operacaoId: null,
    autorizado: false,
    telasPermitidas: null,
  };
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
    .select("papel, clinica_id, ativo, telas_permitidas")
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

  const telasPermitidas = telasPermitidasValidas(registro.telas_permitidas);

  if (registro.papel === PAPEIS.HERVAL_ADMIN) {
    if (operacaoId !== null) return semAutorizacao(user.id, nome);
    return {
      usuarioId: user.id,
      nome,
      papel: PAPEIS.HERVAL_ADMIN,
      operacaoId: null,
      autorizado: true,
      telasPermitidas,
    };
  }

  if (operacaoId === null) return semAutorizacao(user.id, nome);

  return {
    usuarioId: user.id,
    nome,
    papel: registro.papel,
    operacaoId,
    autorizado: true,
    telasPermitidas,
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

/**
 * Se um colaborador (`cliente_operacional`) pode abrir uma das quatro telas
 * opcionais — Leads, Conversas, Relatórios ou Agenda.
 *
 * Só restringe quem é colaborador. `herval_admin` e `cliente_admin` sempre
 * passam: a permissão granular é o que o ADMIN DA CLÍNICA libera para quem
 * ele mesmo convidou, não algo que a Herval ou o próprio admin precisem pedir
 * para ver a própria operação.
 *
 * `telasPermitidas === null` é "sem restrição configurada" — o padrão de todo
 * colaborador até o `cliente_admin` abrir Equipe e mexer nisso.
 */
export function telaPermitidaParaColaborador(
  autorizacao: Autorizacao | null,
  tela: TelaControlavel,
): boolean {
  if (autorizacao?.autorizado !== true) return false;
  if (autorizacao.papel !== PAPEIS.CLIENTE_OPERACIONAL) return true;
  if (autorizacao.telasPermitidas === null) return true;
  return autorizacao.telasPermitidas.includes(tela);
}

/**
 * A tranca de cada uma das quatro telas opcionais do cliente — Leads
 * (`/funil`), Conversas (`/atendimento`), Relatórios e Agenda.
 *
 * Visão Geral não entra aqui: é a única tela que todo cliente sempre vê, do
 * mesmo jeito que Equipe nunca entrou em `exigirClienteAdmin`. Chamada na
 * primeira linha de cada uma das quatro páginas — o menu já escondia o link
 * de quem não tinha a tela liberada, mas o menu não impede ninguém de digitar
 * o endereço direto.
 *
 * Sem sessão, cai no login; com sessão mas sem a tela liberada (ou sem
 * autorização nenhuma), cai na Visão Geral — mesmo padrão de
 * `exigirHervalAdmin` e `exigirClienteAdmin`.
 *
 * Recebe a autorização já carregada quando a página tiver chamado
 * `carregarAutorizacao()` por outro motivo (ex.: decidir o texto do seletor),
 * para não dobrar a ida ao banco; carrega sozinha quando a página não tinha
 * motivo próprio para isso.
 */
export async function exigirTela(
  tela: TelaControlavel,
  autorizacaoJaCarregada?: Autorizacao | null,
): Promise<Autorizacao> {
  const autorizacao =
    autorizacaoJaCarregada !== undefined
      ? autorizacaoJaCarregada
      : await carregarAutorizacao();

  if (!autorizacao) redirect("/login");
  if (!telaPermitidaParaColaborador(autorizacao, tela)) {
    redirect("/visao-geral");
  }

  return autorizacao;
}

/**
 * A tranca das telas exclusivas da Herval (Fila de Tarefas, Clientes,
 * Procedimentos, Estratégia do Cliente, Quebra de Objeções, Régua de
 * Automação, Templates de WhatsApp, Integrações, Teste da IA).
 *
 * Chamada na primeira linha de cada uma dessas páginas — o menu já escondia o
 * link para quem é cliente, mas o menu não impede ninguém de digitar o
 * endereço direto. Sem sessão, cai no login; com sessão mas sem ser da Herval
 * (cliente ou autorização nenhuma), cai na Visão Geral, que é o que a conta
 * dela sabe abrir.
 *
 * Devolve a autorização só para a página não precisar carregá-la de novo
 * quando também precisar do nome ou do id de quem está logado.
 */
export async function exigirHervalAdmin(): Promise<Autorizacao> {
  const autorizacao = await carregarAutorizacao();

  if (!autorizacao) redirect("/login");
  if (!ehHervalAdmin(autorizacao)) redirect("/visao-geral");

  return autorizacao;
}

/**
 * A tranca da Equipe — a única tela que o próprio cliente usa para conceder
 * acesso a mais gente da clínica dele, e para decidir, por colaborador,
 * quais das quatro telas opcionais ele vê.
 *
 * Só `cliente_admin` entra: `cliente_operacional` já é quem foi convidado por
 * alguém, não quem convida ou configura, e a Herval administra o acesso das
 * clínicas por `Clientes` (`exigirHervalAdmin`), não por aqui. Sem sessão, cai
 * no login; com sessão mas sem ser `cliente_admin`, cai na Visão Geral — mesmo
 * padrão de `exigirHervalAdmin`, só que para o papel oposto.
 */
export async function exigirClienteAdmin(): Promise<Autorizacao> {
  const autorizacao = await carregarAutorizacao();

  if (!autorizacao) redirect("/login");
  if (!autorizacao.autorizado || autorizacao.papel !== PAPEIS.CLIENTE_ADMIN) {
    redirect("/visao-geral");
  }

  return autorizacao;
}
