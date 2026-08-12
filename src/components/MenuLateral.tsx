"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ListChecks,
  KanbanSquare,
  CalendarDays,
  Building2,
  MessageSquareWarning,
  MessageSquareText,
  Plug,
  LayoutDashboard,
  Workflow,
  Bot,
  Stethoscope,
  ClipboardList,
} from "lucide-react";
import LogoHerval from "@/components/LogoHerval";

const itens = [
  { href: "/visao-geral", rotulo: "Visão Geral", Icone: LayoutDashboard },
  { href: "/", rotulo: "Fila de Tarefas", Icone: ListChecks },
  { href: "/funil", rotulo: "Funil", Icone: KanbanSquare },
  { href: "/agenda", rotulo: "Agenda", Icone: CalendarDays },
  { href: "/teste-ia", rotulo: "Teste da IA", Icone: Bot },
  { href: "/regua-automacao", rotulo: "Régua de Automação", Icone: Workflow },
  { href: "/profissionais", rotulo: "Profissionais", Icone: Stethoscope },
  { href: "/especialidades", rotulo: "Especialidades", Icone: ClipboardList },
  { href: "/estrategia", rotulo: "Estratégia da Clínica", Icone: Building2 },
  { href: "/objecoes", rotulo: "Quebra de Objeções", Icone: MessageSquareWarning },
  {
    href: "/templates-whatsapp",
    rotulo: "Templates de WhatsApp",
    Icone: MessageSquareText,
  },
  { href: "/integracoes", rotulo: "Integrações", Icone: Plug },
];

export default function MenuLateral() {
  const caminho = usePathname();

  return (
    <aside className="fixed bottom-0 left-0 top-16 z-20 flex w-56 flex-col bg-herval-preto md:w-64">
      {/* Com o menu maior, a lista rola sozinha em telas baixas. */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-6">
        {itens.map(({ href, rotulo, Icone }) => {
          const ativo = caminho === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={[
                "flex items-center gap-3 rounded-controle px-3.5 py-3 text-sm transition-colors",
                ativo
                  ? "bg-herval-verde font-bold text-herval-preto"
                  : "font-medium text-white/70 hover:bg-white/10 hover:text-herval-branco",
              ].join(" ")}
            >
              <Icone className="h-4 w-4 shrink-0" />
              {rotulo}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-white/10 px-5 py-5">
        <LogoHerval className="h-8 w-8 rounded-controle" />
        <span className="text-xs font-medium text-white/50">
          Versão de demonstração
        </span>
      </div>
    </aside>
  );
}
