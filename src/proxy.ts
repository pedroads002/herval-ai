import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  supabaseChaveAnon,
  supabaseConfigurado,
  supabaseUrl,
} from "@/lib/supabase/config";

const TELA_DE_LOGIN = "/login";

/**
 * Telas que qualquer pessoa abre sem estar logada, e que também não empurram
 * quem já está logado para outro lugar.
 *
 * A política de privacidade está aqui porque precisa estar: a Meta exige uma
 * URL de política de privacidade que o revisor dela consiga abrir sem conta e
 * sem senha. Atrás do login, a URL não serviria para nada.
 *
 * Esta lista é a exceção, não a regra — qualquer outra tela nova continua
 * nascendo protegida sozinha. Só entra aqui o que for público de propósito, e
 * nada que leia ou grave dado de paciente, lead ou cliente.
 */
const TELAS_PUBLICAS: readonly string[] = ["/privacidade"];

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
  if (TELAS_PUBLICAS.includes(caminho)) return NextResponse.next();

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
  if (user && naTelaDeLogin) return irPara(request, "/");

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
