import { createBrowserClient } from "@supabase/ssr";
import { supabaseChaveAnon, supabaseUrl } from "@/lib/supabase/config";

/** Cliente usado dentro do navegador (formulário de login). */
export function criarClienteNavegador() {
  return createBrowserClient(supabaseUrl, supabaseChaveAnon);
}
