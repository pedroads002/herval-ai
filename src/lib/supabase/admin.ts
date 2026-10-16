import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/config";

/**
 * Cliente Supabase com a chave `service_role` — ignora toda política de RLS.
 *
 * USO RESTRITO: só estas rotas/páginas importam este arquivo —
 * `src/app/api/admin/provisionar-cliente/route.ts`,
 * `src/app/api/admin/convidar-cliente/route.ts`,
 * `src/app/api/convite/completar/route.ts`, `src/app/convite/[token]/page.tsx`
 * e `src/lib/dados/equipe.ts`.
 * Nenhum outro lugar do projeto precisa de um cliente privilegiado — a leitura
 * e a escrita de todas as telas e Server Actions continuam pela sessão do
 * próprio usuário (`criarClienteServidor`), sujeitas à RLS. Se um dia outro
 * arquivo achar que precisa importar daqui, a pergunta a responder primeiro é
 * a mesma que estas rotas responderam: "por que a sessão do próprio usuário
 * não basta?".
 *
 * A instância só nasce dentro da função que a chama (nunca no topo do
 * módulo), para a ausência da variável de ambiente virar um retorno `null`
 * tratado pela rota (503), e não uma exceção na hora de o servidor subir.
 */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !chave) return null;

  return createClient(supabaseUrl, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
