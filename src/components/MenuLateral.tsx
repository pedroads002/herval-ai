"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ListChecks,
  KanbanSquare,
  CalendarDays,
  BarChart3,
  Building2,
  MessageSquareWarning,
  MessageSquareText,
  MessagesSquare,
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
  { href: "/relatorios", rotulo: "Relatórios", Icone: BarChart3 },
  { href: "/", rotulo: "Fila de Tarefas", Icone: ListChecks },
  { href: "/atendimento", rotulo: "Atendimento", Icone: MessagesSquare },
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
          /**
           * O item continua aceso nas telas internas da seção — abrir a
           * conversa de um lead não apaga "Atendimento" no menu. A raiz fica
           * de fora da regra: todo caminho começa com "/".
           */
          const ativo =
            caminho === href ||
            (href !== "/" && caminho.startsWith(`${href}/`));
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

      {/*
        Duas linhas: o nome do produto e quem o desenvolveu. A assinatura ficava
        solta no fim da página e obrigava a rolagem; aqui ela tem lugar fixo.

        A segunda linha é menor e mais apagada que a primeira de propósito — é
        crédito, não título, e igualar as duas faria o nome do produto competir
        com a assinatura.
      */}
      <div className="flex shrink-0 items-center gap-2.5 border-t border-white/10 px-5 py-5">
        <LogoHerval className="h-8 w-8 shrink-0 rounded-controle" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/50">Helô - Herval AI</p>
          {/* A entrelinha apertada é porque o texto quebra em duas linhas na
              largura do menu: solta, a quebra parecia defeito. */}
          <p className="mt-0.5 text-[11px] font-medium leading-tight text-white/35">
            Desenvolvido por Herval Marketing®
          </p>
        </div>
      </div>
    </aside>
  );
}
