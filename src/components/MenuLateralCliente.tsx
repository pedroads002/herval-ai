"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  KanbanSquare,
  CalendarDays,
  BarChart3,
  MessagesSquare,
  LayoutDashboard,
  Users,
} from "lucide-react";
import LogoHerval from "@/components/LogoHerval";

/**
 * O menu de quem é cliente (`cliente_admin` ou `cliente_operacional`).
 *
 * É o `MenuLateral` da Herval, só que cortado para as cinco telas que o
 * autocadastro prometeu: visão geral, leads (Funil), conversas (Atendimento,
 * de onde também sai a mensagem manual), relatórios e agenda. Fora daqui:
 * Fila de Tarefas, Teste da IA, Régua de Automação, Clientes, Procedimentos,
 * Estratégia do Cliente, Quebra de Objeções, Templates de WhatsApp e
 * Integrações — tudo isso é operação da Herval sobre VÁRIOS clientes, não
 * ferramenta de um cliente sobre a própria conta.
 *
 * Equipe é a sexta, e só aparece para `cliente_admin` — é de lá que ela
 * convida colaborador para a própria clínica. `cliente_operacional` não vê o
 * link porque não é quem convida (ver `exigirClienteAdmin`): se entrasse na
 * tela, só cairia de volta na Visão Geral.
 *
 * Esconder o link aqui não é a tranca de verdade — é só não oferecer o
 * caminho. Quem impede de fato é `exigirHervalAdmin` (para as telas da
 * Herval) e `exigirClienteAdmin` (para Equipe), chamados na primeira linha de
 * cada uma daquelas páginas: são eles que fazem digitar o endereço na mão não
 * servir de nada.
 */
const itensFixos = [
  { href: "/visao-geral", rotulo: "Visão Geral", Icone: LayoutDashboard },
  { href: "/funil", rotulo: "Leads", Icone: KanbanSquare },
  { href: "/atendimento", rotulo: "Conversas", Icone: MessagesSquare },
  { href: "/relatorios", rotulo: "Relatórios", Icone: BarChart3 },
  { href: "/agenda", rotulo: "Agenda", Icone: CalendarDays },
];

const itemDeEquipe = {
  href: "/equipe",
  rotulo: "Equipe",
  Icone: Users,
};

export default function MenuLateralCliente({
  mostrarEquipe = false,
}: {
  mostrarEquipe?: boolean;
}) {
  const caminho = usePathname();
  const itens = mostrarEquipe ? [...itensFixos, itemDeEquipe] : itensFixos;

  return (
    <aside className="fixed bottom-0 left-0 top-16 z-20 flex w-56 flex-col bg-herval-preto md:w-64">
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-6">
        {itens.map(({ href, rotulo, Icone }) => {
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

      <div className="flex shrink-0 items-center gap-2.5 border-t border-white/10 px-5 py-5">
        <LogoHerval className="h-8 w-8 shrink-0 rounded-controle" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/50">Helô - Herval AI</p>
          <p className="mt-0.5 text-[11px] font-medium leading-tight text-white/35">
            Desenvolvido por Herval Marketing®
          </p>
        </div>
      </div>
    </aside>
  );
}
