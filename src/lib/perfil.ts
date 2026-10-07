import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

export type Perfil = {
  nomeCompleto: string;
  iniciais: string;
  email: string;
  /**
   * Nome e sobrenome como estão guardados, sem a substituição pelo e-mail.
   * A tela de Perfil precisa deles separados para preencher os campos — e
   * precisa do vazio como vazio, senão o e-mail apareceria dentro do campo
   * "Nome" como se alguém o tivesse digitado.
   */
  nome: string;
  sobrenome: string;
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

  // Uma letra só, a primeira do nome — é o "E" que já está no círculo hoje,
  // vindo do e-mail. Com o perfil preenchido ele continua sendo uma letra: a de
  // "Equipe", a de "Pedro". Duas iniciais trocariam o que está na tela.
  const iniciais = primeiraLetra(perfil?.nome);

  return {
    nomeCompleto: nomeCompleto || email,
    iniciais: iniciais || primeiraLetra(email) || "?",
    email,
    nome: (perfil?.nome ?? "").trim(),
    sobrenome: (perfil?.sobrenome ?? "").trim(),
  };
}
