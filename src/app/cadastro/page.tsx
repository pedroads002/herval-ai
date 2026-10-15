import type { Metadata } from "next";
import { Info } from "lucide-react";
import LogoHerval from "@/components/LogoHerval";
import Rodape from "@/components/Rodape";

export const metadata: Metadata = {
  title: "Criar conta · Herval AI",
};

/**
 * Esta URL fixa de cadastro foi substituída pelo convite por link (ver
 * `src/app/convite/[token]/page.tsx`): cada cliente agora recebe um link
 * próprio, gerado pela Herval na tela do cliente. Fica aqui só o aviso — não
 * apaga o arquivo, mas também não oferece mais o formulário antigo, que
 * dependia de uma coluna (`clinicas.codigo_acesso`) que não existe mais.
 */
export default function PaginaCadastro() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <LogoHerval className="h-24 w-24 rounded-card p-2.5" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-herval-preto">
              Acesso por convite
            </h1>
          </div>
        </div>

        <div className="rounded-card bg-herval-branco p-7 shadow-card">
          <p className="flex items-start gap-2 text-sm font-medium text-black/65">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-herval-preto" />
            Este cadastro agora é feito por um link enviado pela Herval, não
            por esta página. Se você é cliente da Herval, peça o link de
            convite a quem cuida da sua conta.
          </p>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-black/45">
          Já tem conta?{" "}
          <a href="/login" className="font-bold text-herval-preto underline">
            Entrar
          </a>
        </p>

        <Rodape className="mt-4" />
      </div>
    </main>
  );
}
