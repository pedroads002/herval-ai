import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import LogoHerval from "@/components/LogoHerval";
import FormularioNovaSenha from "@/components/FormularioNovaSenha";
import Rodape from "@/components/Rodape";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Criar senha nova · Herval AI",
};

/**
 * Onde a senha nova é digitada.
 *
 * Esta tela não lê token nenhum: quando ela roda, a rota
 * `/api/recuperar-senha` já trocou o token do e-mail por sessão (é lá que o
 * cookie pode ser gravado). O que decide se o formulário aparece é só isto:
 * existe sessão? Se não existe, o link não valia — expirou, já foi usado, ou
 * a pessoa abriu este endereço na mão.
 *
 * Perguntar ao Supabase com `getUser` e não confiar no cookie é de propósito:
 * o conteúdo do cookie o navegador poderia ter alterado, e quem valida de
 * verdade é o servidor do Supabase. É a mesma regra do `proxy.ts`.
 */
export default async function PaginaRedefinirSenha() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F7F7F7] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <LogoHerval className="h-24 w-24 rounded-card p-2.5" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-herval-preto">
              {user ? "Criar senha nova" : "Link não vale mais"}
            </h1>
            <p className="mt-1 text-sm font-medium text-black/55">
              {user
                ? "Escolha uma senha e guarde num lugar seguro."
                : "Peça outro para continuar."}
            </p>
          </div>
        </div>

        <div className="rounded-card bg-herval-branco p-7 shadow-card">
          {user ? (
            <FormularioNovaSenha />
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-2 text-sm font-bold text-herval-preto">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Este link expirou ou já foi usado
              </p>
              <p className="text-sm leading-relaxed text-black/65">
                O link de recuperação vale por uma hora e só funciona uma vez.
                Pedir outro leva dez segundos.
              </p>
              <Link
                href="/esqueci-senha"
                className="flex w-full items-center justify-center rounded-controle bg-herval-verde px-4 py-3 text-sm font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
              >
                Pedir outro link
              </Link>
            </div>
          )}
        </div>

        <Rodape className="mt-6" />
      </div>
    </main>
  );
}
