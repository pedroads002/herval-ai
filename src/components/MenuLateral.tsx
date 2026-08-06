"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ListChecks,
  Building2,
  MessageSquareWarning,
  Plug,
} from "lucide-react";

const itens = [
  { href: "/", rotulo: "Fila de Tarefas", Icone: ListChecks },
  { href: "/estrategia", rotulo: "Estratégia da Clínica", Icone: Building2 },
  { href: "/objecoes", rotulo: "Quebra de Objeções", Icone: MessageSquareWarning },
  { href: "/integracoes", rotulo: "Integrações", Icone: Plug },
];

export default function MenuLateral() {
  const caminho = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col bg-menu text-slate-200 md:w-64">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-marca font-bold text-white">
          H
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Herval AI</p>
          <p className="text-xs text-slate-400">Painel operacional</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {itens.map(({ href, rotulo, Icone }) => {
          const ativo = caminho === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                ativo
                  ? "bg-marca text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-6 text-xs text-slate-500">
        Versão de demonstração
      </div>
    </aside>
  );
}
