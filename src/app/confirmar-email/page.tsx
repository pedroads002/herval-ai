import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/**
 * Onde o link de confirmação de e-mail cai — nunca `/login` direto, e nunca
 * `/`.
 *
 * O token que o Supabase manda vem como `#access_token=...` depois do
 * endereço, e fragmento de URL nunca chega ao servidor — é regra do próprio
 * navegador, não escolha nossa. Então nenhuma tela aqui jamais lê esse token,
 * nem precisa: o link de confirmação só confirma o e-mail. Quem entra de
 * fato é sempre o formulário de login, com e-mail e senha.
 *
 * O perigo que esta tela existe para fechar: se o navegador que clicou no
 * link já estava com sessão de OUTRA conta (a principal da Herval, por
 * exemplo), cair direto em `/` ou em `/login` deixaria essa sessão antiga
 * valendo — a pessoa veria o painel de quem já estava logado, não o da conta
 * que acabou de confirmar o e-mail. Por isso esta tela não renderiza nada:
 * encerra qualquer sessão que já exista neste navegador, sempre, e só depois
 * manda para o login — para que a pessoa entre com o e-mail e a senha da
 * conta que de fato acabou de criar.
 */
export default async function PaginaConfirmarEmail() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
