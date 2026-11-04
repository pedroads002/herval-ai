"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

/**
 * A moldura do menu lateral: no computador é a barra fixa de sempre, no celular
 * é uma gaveta que entra por cima do conteúdo.
 *
 * Existe porque a barra fixa de 224px não cabe num telefone — ela sobrava na
 * tela e empurrava o conteúdo para uma faixa de ~160px, deixando toda a parte
 * de dentro ilegível. Aqui, abaixo de `md`, a barra sai da tela
 * (`-translate-x-full`) e só volta quando a pessoa toca no botão; de `md` para
 * cima `md:translate-x-0` manda ela ficar sempre visível, e nada muda em
 * relação ao que já estava no ar.
 *
 * Quem decide *o que* aparece dentro continua sendo `MenuLateral` (Herval) e
 * `MenuLateralCliente` (cliente) — esta peça só cuida de aparecer e desaparecer,
 * para os dois não repetirem a mesma mecânica.
 *
 * Fecha ao clicar em qualquer lugar dentro da gaveta, e é isso que fecha ao
 * navegar: os itens do menu são links, e o clique neles sobe até aqui. No
 * computador o estado já é "fechado" e a barra fica visível pelo `md:`, então
 * esse mesmo clique não tem efeito nenhum.
 */
export default function MenuGaveta({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/*
        O botão mora na faixa do cabeçalho, à esquerda da logo — por isso o
        cabeçalho reserva esse espaço no celular (ver `CabecalhoTopo`). Fica
        acima do cabeçalho no empilhamento (z-40 contra z-30) para o toque
        chegar nele, e não no cabeçalho por baixo.
      */}
      <button
        type="button"
        onClick={() => setAberto((estava) => !estava)}
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        aria-expanded={aberto}
        className="fixed left-0 top-0 z-40 grid h-16 w-14 place-items-center text-herval-preto md:hidden"
      >
        {aberto ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/*
        Cortina atrás da gaveta: escurece o conteúdo para a gaveta não parecer
        colada nele, e dá uma área grande para fechar sem precisar acertar o
        botão. Começa embaixo do cabeçalho para o botão continuar alcançável.
      */}
      {aberto && (
        <div
          aria-hidden
          onClick={() => setAberto(false)}
          className="fixed inset-x-0 bottom-0 top-16 z-20 bg-black/50 md:hidden"
        />
      )}

      <aside
        onClick={() => setAberto(false)}
        className={[
          "fixed bottom-0 left-0 top-16 z-30 flex w-64 flex-col bg-herval-preto transition-transform duration-200 md:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {children}
      </aside>
    </>
  );
}
