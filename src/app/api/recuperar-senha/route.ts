import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/**
 * Onde o link do e-mail de recuperação cai.
 *
 * É uma rota, e não uma tela, por uma razão técnica dura: trocar o token por
 * sessão grava cookie, e no Next cookie só pode ser gravado em Route Handler
 * ou Server Action — nunca numa página (ver `node_modules/next/dist/docs`,
 * `01-app/03-api-reference/04-functions/cookies.md`). Uma página tentando
 * fazer isso falha em silêncio: a pessoa chegaria em "/redefinir-senha" sem
 * sessão nenhuma e veria "link inválido" mesmo com o link certo.
 *
 * O modelo de e-mail no Supabase precisa apontar para cá, assim:
 *
 *   {{ .SiteURL }}/api/recuperar-senha?token_hash={{ .TokenHash }}&type=recovery
 *
 * e não para o `{{ .ConfirmationURL }}` padrão. Dois motivos, nenhum deles
 * preferência: o padrão devolve o token no fragmento da URL (depois do `#`),
 * que o navegador nunca envia ao servidor — o mesmo motivo já explicado em
 * `app/confirmar-email/page.tsx` —, e o fluxo padrão deste cliente só valida
 * se o link for aberto no MESMO navegador que pediu a recuperação. Com
 * `token_hash` funciona em qualquer aparelho, que é o caso real: pedir no
 * computador e abrir o e-mail no celular.
 */
export async function GET(request: NextRequest) {
  const parametros = request.nextUrl.searchParams;
  const tokenHash = parametros.get("token_hash");
  const tipo = parametros.get("type");

  if (!tokenHash || tipo !== "recovery") return irPara(request, true);

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  // Token velho, já usado ou adulterado. A tela de destino é a mesma: ela é
  // que explica o que houve e oferece pedir outro link.
  return irPara(request, Boolean(error));
}

function irPara(request: NextRequest, invalido: boolean) {
  const destino = request.nextUrl.clone();
  destino.pathname = "/redefinir-senha";
  // A query é refeita do zero para o `token_hash` não ficar pendurado na
  // barra de endereços depois do redirecionamento.
  destino.search = invalido ? "?invalido=1" : "";
  return NextResponse.redirect(destino);
}
