import LogoHerval from "@/components/LogoHerval";

export default function CabecalhoTopo() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-black/10 bg-herval-branco shadow-topo">
      <div className="flex h-full items-center gap-3 px-6">
        <LogoHerval variante="light" className="h-9 w-9" />

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight text-herval-preto">
            Herval AI
          </span>
          <span className="hidden text-xs font-medium text-black/50 sm:inline">
            Painel operacional
          </span>
        </div>

        <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-herval-verde/10 px-3 py-1.5 text-xs font-bold text-herval-preto">
          <span className="h-2 w-2 rounded-full bg-herval-verde" />
          Demonstração
        </span>
      </div>
    </header>
  );
}
