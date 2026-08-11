/**
 * Endereço e chave pública do projeto Supabase.
 *
 * Ficam em .env.local (fora do Git). Enquanto não forem preenchidos, o sistema
 * inteiro fica bloqueado e a tela de login explica o que falta, em vez de
 * quebrar com erro técnico.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseChaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function supabaseConfigurado() {
  // O .env.local nasce com textos de exemplo entre < >. Enquanto estiverem lá,
  // vale como não configurado, para não tentar conectar em um endereço inválido.
  const temTextoDeExemplo = (valor: string) =>
    valor.includes("<") || valor.includes(">");

  return (
    supabaseUrl.startsWith("http") &&
    supabaseChaveAnon.length > 0 &&
    !temTextoDeExemplo(supabaseUrl) &&
    !temTextoDeExemplo(supabaseChaveAnon)
  );
}
