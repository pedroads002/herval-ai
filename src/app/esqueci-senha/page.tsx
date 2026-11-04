import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import LogoHerval from "@/components/LogoHerval";
import FormularioEsqueciSenha from "@/components/FormularioEsqueciSenha";
import Rodape from "@/components/Rodape";
import { supabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Esqueci minha senha · Herval AI",
};

/**
 * Onde quem perdeu a senha pede um link novo.
 *
 * Mesma moldura da tela de login de propósito: quem chega aqui chegou de lá,
 * e mudar a aparência no meio do caminho faria parecer outro site — que é
 * exatamente a desconfiança que não se quer numa tela de senha.
 */
export default function PaginaEsqueciSenha() {
  const configurado = supabaseConfigurado();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F7F7F7] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <LogoHerval className="h-24 w-24 rounded-card p-2.5" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-herval-preto">
              Esqueci minha senha
            </h1>
            <p className="mt-1 text-sm font-medium text-black/55">
              Em dois passos você volta a entrar no painel.
            </p>
          </div>
        </div>

        <div className="rounded-card bg-herval-branco p-7 shadow-card">
          {configurado ? (
            <FormularioEsqueciSenha />
          ) : (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm font-bold text-herval-preto">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Configuração pendente
              </p>
              <p className="text-sm leading-relaxed text-black/65">
                As chaves do Supabase ainda não foram preenchidas, então não há
                como enviar o e-mail. Procure quem cuida da sua conta na Herval.
              </p>
            </div>
          )}
        </div>

        <Rodape className="mt-6" />
      </div>
    </main>
  );
}
