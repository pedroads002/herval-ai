import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  supabaseChaveAnon,
  supabaseConfigurado,
  supabaseUrl,
} from "@/lib/supabase/config";

const TELA_DE_LOGIN = "/login";
const PRIMEIRA_TELA = "/visao-geral";

/**
 * Telas (e rotas de API) que qualquer pessoa abre sem estar logada, e que
 * também não empurram quem já está logado para outro lugar.
 *
 * A política de privacidade está aqui porque precisa estar: a Meta exige uma
 * URL de política de privacidade que o revisor dela consiga abrir sem conta e
 * sem senha. Atrás do login, a URL não serviria para nada.
 *
 * `/convite` e `/api/convite/completar` estão aqui pelo mesmo motivo: quem
 * abre um link de convite ou envia o formulário de autocadastro, por
 * definição, ainda não tem conta — não existe sessão nenhuma para este
 * `proxy` conferir. A rota já faz sua própria conferência (token válido, não
 * usado, não expirado, código de acesso certo); sem esta entrada na lista,
 * o `proxy` barra a pessoa antes mesmo dela chegar lá, mandando-a pro login
 * — exatamente o bug observado (convite abrindo a tela de login).
 *
 * Esta lista é a exceção, não a regra — qualquer outra tela nova continua
 * nascendo protegida sozinha. Só entra aqui o que for público de propósito, e
 * nada que leia ou grave dado de paciente, lead ou cliente.
 */
const TELAS_PUBLICAS: readonly string[] = [
  "/privacidade",
  "/convite",
  "/api/convite/completar",
];

/**
 * Compara por prefixo, não só por igualdade: `/convite` cobre `/convite` e
 * qualquer `/convite/<token>` por baixo dele, sem precisar listar token por
 * token (o que seria impossível, já que cada um é gerado na hora).
 */
function ehTelaPublica(caminho: string) {
  return TELAS_PUBLICAS.some(
    (publica) => caminho === publica || caminho.startsWith(`${publica}/`),
  );
}

/**
 * Roda antes de qualquer tela ser renderizada (no Next 16 este arquivo se chama
 * proxy.ts; era o antigo middleware.ts). Como o matcher pega tudo, qualquer
 * tela nova criada no futuro já nasce protegida, sem precisar mexer aqui.
 */
export async function proxy(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  const naTelaDeLogin = caminho === TELA_DE_LOGIN;

  // Tela pública passa direto, logado ou não. Nem chega a consultar o Supabase:
  // não há sessão para validar nem cookie para renovar.
  if (ehTelaPublica(caminho)) return NextResponse.next();

  // Sem as chaves do Supabase ninguém entra: só a tela de login responde, e ela
  // mostra o aviso de configuração pendente.
  if (!supabaseConfigurado()) {
    return naTelaDeLogin ? NextResponse.next() : irPara(request, TELA_DE_LOGIN);
  }

  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseChaveAnon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (paraGravar, cabecalhos) => {
        paraGravar.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        resposta = NextResponse.next({ request });
        paraGravar.forEach(({ name, value, options }) =>
          resposta.cookies.set(name, value, options),
        );
        // Impede que a resposta com cookie de sessão fique em cache.
        Object.entries(cabecalhos ?? {}).forEach(([chave, valor]) =>
          resposta.headers.set(chave, valor),
        );
      },
    },
  });

  // getUser valida o token no servidor do Supabase; não dá para confiar só no
  // conteúdo do cookie, que o navegador poderia ter alterado. Se o Supabase
  // estiver fora do ar, tratamos como "não logado" em vez de derrubar a tela.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user && !naTelaDeLogin) return irPara(request, TELA_DE_LOGIN);
  // Quem já está logado não fica na tela de login: vai para a Visão Geral, a
  // primeira seção do menu. Não para "/", que é a Fila de Tarefas — tela
  // exclusiva de admin Herval, e não a página inicial do sistema. É este
  // desvio, e não o `router.replace` do formulário, que decide onde o login
  // termina: o `router.refresh()` revalida `/login` com a sessão já criada e
  // esta linha responde antes da navegação do formulário chegar.
  if (user && naTelaDeLogin) return irPara(request, PRIMEIRA_TELA);

  return resposta;
}

function irPara(request: NextRequest, caminho: string) {
  const destino = request.nextUrl.clone();
  destino.pathname = caminho;
  destino.search = "";
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: [
    // Tudo, menos arquivos internos do Next e imagens da pasta public.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
