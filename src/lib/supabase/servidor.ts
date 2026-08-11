import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseChaveAnon, supabaseUrl } from "@/lib/supabase/config";

/**
 * Cliente usado no servidor (componentes de servidor e server actions).
 * Lê e grava a sessão nos cookies da requisição atual.
 */
export async function criarClienteServidor() {
  const armazem = await cookies();

  return createServerClient(supabaseUrl, supabaseChaveAnon, {
    cookies: {
      getAll: () => armazem.getAll(),
      setAll: (paraGravar) => {
        try {
          paraGravar.forEach(({ name, value, options }) =>
            armazem.set(name, value, options),
          );
        } catch {
          // Componentes de servidor não podem gravar cookies. Quem renova a
          // sessão nesse caso é o proxy, então aqui podemos ignorar.
        }
      },
    },
  });
}
