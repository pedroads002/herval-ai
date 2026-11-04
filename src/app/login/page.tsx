import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import LogoHerval from "@/components/LogoHerval";
import FormularioLogin from "@/components/FormularioLogin";
import Rodape from "@/components/Rodape";
import { supabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Entrar · Herval AI",
};

/**
 * `senhaAlterada` chega de `/redefinir-senha`, que encerra a sessão e manda
 * para cá. Sem esse aviso, a pessoa que acabou de trocar a senha cairia na
 * tela de entrar sem nenhum sinal de que deu certo — e a leitura natural
 * disso é "não funcionou", não "agora entre com a senha nova".
 */
export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ senhaAlterada?: string }>;
}) {
  const { senhaAlterada } = await searchParams;
  const configurado = supabaseConfigurado();

  return (
    <main
      /*
        `min-h-[100dvh]` e não `min-h-screen`: no celular `screen` vale
        `100vh`, que é a tela como se a barra do navegador não existisse. A
        caixa de login ficava centralizada numa altura maior que a visível,
        aparecia empurrada para baixo e a tela ganhava uma rolagem que não
        devia existir. `dvh` é o que está de fato visível. No computador as
        duas medidas são iguais.
      */
      className="flex min-h-[100dvh] items-center justify-center bg-[#F7F7F7] px-6 py-12"
    >
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <LogoHerval className="h-24 w-24 rounded-card p-2.5" />
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
            <FormularioLogin senhaAlterada={senhaAlterada === "1"} />
          ) : (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm font-bold text-herval-preto">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Configuração pendente
              </p>
              <p className="text-sm leading-relaxed text-black/65">
                As chaves do Supabase ainda não foram preenchidas. Crie o
                arquivo <code className="font-bold">.env.local</code> na raiz do
                projeto com{" "}
                <code className="font-bold">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
                <code className="font-bold">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
                , depois reinicie o servidor.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs font-medium text-black/45">
          Acesso por convite. Recebeu um link da Herval? Use-o para concluir o
          cadastro antes de entrar por aqui.
        </p>

        <Rodape className="mt-4" />
      </div>
    </main>
  );
}
