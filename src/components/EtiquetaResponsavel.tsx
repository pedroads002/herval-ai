import { Bot, User, Zap } from "lucide-react";
import type { Responsavel } from "@/data/tarefas";

const icones: Record<Responsavel, typeof Bot> = {
  IA: Bot,
  Humano: User,
  Automática: Zap,
};

/**
 * Selo de quem executa a ação. Usado na Fila de Tarefas e nos cards do Funil,
 * para os dois lugares mostrarem exatamente o mesmo formato.
 */
export default function EtiquetaResponsavel({
  responsavel,
  destacado = false,
}: {
  responsavel: Responsavel;
  /** Preto sólido para ação humana, que é a que exige atenção. */
  destacado?: boolean;
}) {
  const Icone = icones[responsavel];

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        destacado
          ? "bg-herval-preto text-herval-branco"
          : "border border-black/20 text-black/70",
      ].join(" ")}
    >
      <Icone className="h-3.5 w-3.5" />
      {responsavel}
    </span>
  );
}
