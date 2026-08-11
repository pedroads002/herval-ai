import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

export type Perfil = {
  nomeCompleto: string;
  iniciais: string;
  email: string;
};

function primeiraLetra(texto: string | null | undefined) {
  return (texto ?? "").trim().charAt(0).toUpperCase();
}

/**
 * Busca o usuário logado e o registro dele na tabela "profiles".
 * Se o perfil ainda não tiver nome e sobrenome preenchidos, usa o e-mail
 * como texto e a inicial dele no círculo do cabeçalho.
 */
export async function carregarPerfil(): Promise<Perfil | null> {
  if (!supabaseConfigurado()) return null;

  const supabase = await criarClienteServidor();

  const user = await supabase.auth
    .getUser()
    .then(({ data }) => data.user)
    .catch(() => null);

  if (!user) return null;

  // Se a tabela "profiles" ainda não existir, seguimos com o e-mail do usuário
  // em vez de quebrar o cabeçalho.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("nome, sobrenome, email")
    .eq("id", user.id)
    .maybeSingle();

  const email = perfil?.email ?? user.email ?? "";
  const nomeCompleto = [perfil?.nome, perfil?.sobrenome]
    .filter(Boolean)
    .join(" ")
    .trim();

  const iniciais =
    primeiraLetra(perfil?.nome) + primeiraLetra(perfil?.sobrenome);

  return {
    nomeCompleto: nomeCompleto || email,
    iniciais: iniciais || primeiraLetra(email) || "?",
    email,
  };
}
