"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { sair } from "@/lib/acoes/sessao";

/**
 * Círculo com as iniciais do usuário logado. Ao passar o mouse (ou clicar,
 * para quem usa teclado) abre um popover com o nome completo, o e-mail e a
 * opção de sair.
 */
export default function MenuUsuario({
  iniciais,
  nomeCompleto,
  email,
}: {
  iniciais: string;
  nomeCompleto: string;
  email: string;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc, senão o popover fica preso na tela.
  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div
      ref={caixa}
      className="relative ml-auto"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        onClick={() => setAberto((antes) => !antes)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label={`Conta de ${nomeCompleto}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-herval-preto text-xs font-extrabold text-herval-verde transition-colors hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-herval-verde"
      >
        {iniciais}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 w-60 pt-2"
        >
          <div className="rounded-card border border-black/10 bg-herval-branco p-4 shadow-card">
            <p className="text-sm font-bold text-herval-preto">
              {nomeCompleto}
            </p>
            {email && email !== nomeCompleto && (
              <p className="mt-0.5 break-all text-xs font-medium text-black/50">
                {email}
              </p>
            )}

            <form action={sair} className="mt-3 border-t border-black/10 pt-3">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-controle px-2 py-2 text-sm font-bold text-herval-vermelho transition-colors hover:bg-herval-vermelho/10"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
