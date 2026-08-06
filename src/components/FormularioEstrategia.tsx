"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { estrategiaInicial, type Estrategia } from "@/data/estrategia";

const campoBase =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";

export default function FormularioEstrategia() {
  const [estrategia, setEstrategia] = useState<Estrategia>(estrategiaInicial);
  const [salvo, setSalvo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpa o temporizador se a tela for fechada antes dos 2 segundos.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  function alterar(campo: keyof Estrategia, valor: string) {
    setEstrategia((atual) => ({ ...atual, [campo]: valor }));
  }

  // Só mostra a confirmação. Nada é enviado nem salvo.
  function salvar() {
    setSalvo(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <form
      className="max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          História da clínica
        </label>
        <textarea
          rows={4}
          value={estrategia.historia}
          onChange={(e) => alterar("historia", e.target.value)}
          className={campoBase}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Diferenciais
        </label>
        <textarea
          rows={4}
          value={estrategia.diferenciais}
          onChange={(e) => alterar("diferenciais", e.target.value)}
          className={campoBase}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Ticket médio
          </label>
          <input
            type="text"
            value={estrategia.ticketMedio}
            onChange={(e) => alterar("ticketMedio", e.target.value)}
            className={campoBase}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Formas de pagamento
          </label>
          <input
            type="text"
            value={estrategia.formasPagamento}
            onChange={(e) => alterar("formasPagamento", e.target.value)}
            className={campoBase}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Público-alvo
        </label>
        <textarea
          rows={3}
          value={estrategia.publicoAlvo}
          onChange={(e) => alterar("publicoAlvo", e.target.value)}
          className={campoBase}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={salvar}
          className="rounded-lg bg-marca px-4 py-2.5 text-sm font-medium text-white hover:bg-marca-escura"
        >
          Salvar estratégia
        </button>

        {salvo ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"
          >
            <Check className="h-4 w-4" />
            Salvo
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            Tela de demonstração: nada é salvo ainda.
          </span>
        )}
      </div>
    </form>
  );
}
