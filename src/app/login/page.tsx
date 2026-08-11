import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import LogoHerval from "@/components/LogoHerval";
import FormularioLogin from "@/components/FormularioLogin";
import { supabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Entrar · Herval AI",
};

export default function PaginaLogin() {
  const configurado = supabaseConfigurado();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <LogoHerval variante="light" className="h-12 w-12" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-herval-preto">
              Herval AI
            </h1>
            <p className="mt-1 text-sm font-medium text-black/55">
              Entre com seu e-mail e senha para acessar o painel.
            </p>
          </div>
        </div>

        <div className="rounded-card bg-herval-branco p-7 shadow-card">
          {configurado ? (
            <FormularioLogin />
          ) : (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm font-bold text-herval-preto">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Configuração pendente
              </p>
              <p className="text-sm leading-relaxed text-black/65">
                As chaves do Supabase ainda não foram preenchidas. Crie o
                arquivo <code className="font-bold">.env.local</code> na raiz do
                projeto com <code className="font-bold">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{" "}
                e{" "}
                <code className="font-bold">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
                , depois reinicie o servidor.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs font-medium text-black/45">
          Acesso restrito à equipe. As contas são criadas pelo administrador.
        </p>
      </div>
    </main>
  );
}
