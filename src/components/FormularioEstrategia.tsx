"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { estrategiaInicial, type Estrategia } from "@/data/estrategia";

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const rotuloBase = "mb-2 block text-sm font-bold text-herval-preto";

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
      className="max-w-3xl space-y-8 rounded-card border border-black/10 bg-herval-branco p-8 shadow-card"
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label className={rotuloBase}>História da clínica</label>
        <textarea
          rows={4}
          value={estrategia.historia}
          onChange={(e) => alterar("historia", e.target.value)}
          className={campoBase}
        />
      </div>

      <div>
        <label className={rotuloBase}>Diferenciais</label>
        <textarea
          rows={4}
          value={estrategia.diferenciais}
          onChange={(e) => alterar("diferenciais", e.target.value)}
          className={campoBase}
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label className={rotuloBase}>Ticket médio</label>
          <input
            type="text"
            value={estrategia.ticketMedio}
            onChange={(e) => alterar("ticketMedio", e.target.value)}
            className={campoBase}
          />
        </div>
        <div>
          <label className={rotuloBase}>Formas de pagamento</label>
          <input
            type="text"
            value={estrategia.formasPagamento}
            onChange={(e) => alterar("formasPagamento", e.target.value)}
            className={campoBase}
          />
        </div>
      </div>

      <div>
        <label className={rotuloBase}>Público-alvo</label>
        <textarea
          rows={3}
          value={estrategia.publicoAlvo}
          onChange={(e) => alterar("publicoAlvo", e.target.value)}
          className={campoBase}
        />
      </div>

      <div className="flex items-center gap-4 border-t border-black/10 pt-6">
        <button
          type="button"
          onClick={salvar}
          className="rounded-full bg-herval-verde px-6 py-3 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
        >
          Salvar estratégia
        </button>

        {salvo ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde/15 px-3.5 py-2 text-xs font-bold text-herval-preto"
          >
            <Check className="h-4 w-4" />
            Salvo
          </span>
        ) : (
          <span className="text-xs font-medium text-black/45">
            Tela de demonstração: nada é salvo ainda.
          </span>
        )}
      </div>
    </form>
  );
}
