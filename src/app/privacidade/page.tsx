/**
 * A Política de Privacidade da Helô, em página pública.
 *
 * Mora fora do grupo `(painel)` de propósito: a Meta exige uma URL de política
 * de privacidade que qualquer pessoa possa abrir sem conta e sem login para
 * revisar o aplicativo. Por isso esta página não tem menu lateral nem depende
 * de sessão — é só o documento.
 *
 * O texto não está aqui; está em `src/lib/dados/politicaDePrivacidade.ts`.
 * Quando a política mudar, mexe-se só lá.
 */

import type { Metadata } from "next";
import LogoHerval from "@/components/LogoHerval";
import {
  ABERTURA,
  ATUALIZADA_EM,
  SECOES_DA_POLITICA,
  type BlocoDaPolitica,
} from "@/lib/dados/politicaDePrivacidade";

export const metadata: Metadata = {
  title: "Política de Privacidade · Helô - Herval AI",
  description:
    "Como a Helô - Herval AI trata dados pessoais: quais dados, para quais finalidades, com quem são compartilhados e quais direitos o titular pode exercer.",
};

/** O endereço da seção na barra do navegador: #secao-4. */
function ancora(numero: number) {
  return `secao-${numero}`;
}

function Blocos({ blocos }: { blocos: readonly BlocoDaPolitica[] }) {
  return (
    <>
      {blocos.map((bloco, i) => {
        if (bloco.tipo === "paragrafo") {
          return (
            <p key={i} className="text-[15px] leading-relaxed text-black/75">
              {bloco.texto}
            </p>
          );
        }

        if (bloco.tipo === "lista") {
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {bloco.itens.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 text-[15px] leading-relaxed text-black/75"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-herval-verde"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <dl key={i} className="space-y-2.5">
            {bloco.itens.map((item) => (
              <div key={item.rotulo}>
                <dt className="text-xs font-bold uppercase tracking-wide text-black/45">
                  {item.rotulo}
                </dt>
                <dd className="text-[15px] font-medium text-herval-preto">
                  {item.valor.includes("@") ? (
                    <a
                      href={`mailto:${item.valor}`}
                      className="underline decoration-herval-verde decoration-2 underline-offset-2 hover:text-black/70"
                    >
                      {item.valor}
                    </a>
                  ) : (
                    item.valor
                  )}
                </dd>
              </div>
            ))}
          </dl>
        );
      })}
    </>
  );
}

export default function PaginaPoliticaDePrivacidade() {
  return (
    <main className="min-h-screen bg-[#F7F7F7] px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex flex-col items-center gap-3 text-center">
          <LogoHerval className="h-20 w-20 rounded-card p-2" />
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-herval-preto">
              Política de Privacidade
            </h1>
            <p className="mt-1.5 text-sm font-bold text-black/60">
              Helô - Herval AI
            </p>
            <p className="mt-3 text-xs font-medium text-black/45">
              Última atualização: {ATUALIZADA_EM}
            </p>
          </div>
        </header>

        <section className="mt-8 space-y-4 rounded-card bg-herval-branco p-7 shadow-card sm:p-9">
          {ABERTURA.map((paragrafo) => (
            <p
              key={paragrafo}
              className="text-[15px] leading-relaxed text-black/75"
            >
              {paragrafo}
            </p>
          ))}
        </section>

        <nav
          aria-label="Seções desta política"
          className="mt-5 rounded-card bg-herval-branco p-7 shadow-card sm:p-9"
        >
          <h2 className="text-xs font-bold uppercase tracking-wide text-black/45">
            Nesta página
          </h2>
          <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {SECOES_DA_POLITICA.map((secao) => (
              <li key={secao.numero} className="flex gap-2 text-sm">
                <span className="font-bold text-black/35">{secao.numero}.</span>
                <a
                  href={`#${ancora(secao.numero)}`}
                  className="font-medium text-black/70 underline decoration-black/15 underline-offset-2 hover:text-herval-preto hover:decoration-herval-verde"
                >
                  {secao.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-5 space-y-5">
          {SECOES_DA_POLITICA.map((secao) => (
            <section
              key={secao.numero}
              id={ancora(secao.numero)}
              className="scroll-mt-6 rounded-card bg-herval-branco p-7 shadow-card sm:p-9"
            >
              <h2 className="text-lg font-extrabold tracking-tight text-herval-preto">
                <span className="text-black/35">{secao.numero}.</span>{" "}
                {secao.titulo}
              </h2>

              <div className="mt-4 space-y-4">
                <Blocos blocos={secao.blocos} />
              </div>

              {secao.subsecoes?.map((subsecao) => (
                <div
                  key={subsecao.numero}
                  className="mt-7 border-t border-black/5 pt-6"
                >
                  <h3 className="text-[15px] font-bold text-herval-preto">
                    <span className="text-black/35">{subsecao.numero}.</span>{" "}
                    {subsecao.titulo}
                  </h3>
                  <div className="mt-3.5 space-y-4">
                    <Blocos blocos={subsecao.blocos} />
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-8 text-center text-xs font-medium text-black/40">
          Desenvolvido por Herval Marketing®
        </footer>
      </div>
    </main>
  );
}
