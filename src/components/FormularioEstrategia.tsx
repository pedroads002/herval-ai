"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info } from "lucide-react";
import {
  estrategiaInicial,
  modoInicial,
  modosAtendimento,
  type Estrategia,
  type ModoAtendimento,
} from "@/data/estrategia";

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const rotuloBase = "mb-2 block text-sm font-bold text-herval-preto";

export default function FormularioEstrategia() {
  const [estrategia, setEstrategia] = useState<Estrategia>(estrategiaInicial);
  const [modo, setModo] = useState<ModoAtendimento>(modoInicial);
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

  const descricaoModo = modosAtendimento.find((m) => m.modo === modo)?.descricao;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Modo de atendimento da IA */}
      <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
        <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
          <span className="h-4 w-1 rounded-full bg-herval-verde" />
          Modo de atendimento da IA
        </h2>

        <div
          role="radiogroup"
          aria-label="Modo de atendimento da IA"
          className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-black/15 p-1"
        >
          {modosAtendimento.map(({ modo: opcao }) => {
            const ativo = opcao === modo;
            return (
              <button
                key={opcao}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setModo(opcao)}
                className={[
                  "rounded-full px-5 py-2 text-sm font-bold transition-colors",
                  ativo
                    ? "bg-herval-verde text-herval-preto"
                    : "text-black/60 hover:bg-black/5 hover:text-herval-preto",
                ].join(" ")}
              >
                {opcao}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm font-medium text-black/60">
          {descricaoModo}
        </p>

        <p className="mt-4 inline-flex items-start gap-2 rounded-controle bg-black/[0.04] px-4 py-3 text-xs font-medium text-black/70">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O primeiro contato de lead novo é sempre humano, independente do modo
          selecionado.
        </p>
      </section>

      {/* Dados da clínica */}
      <form
        className="space-y-8 rounded-card border border-black/10 bg-herval-branco p-8 shadow-card"
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

        <div>
          <label className={rotuloBase}>Endereço</label>
          <input
            type="text"
            value={estrategia.endereco}
            onChange={(e) => alterar("endereco", e.target.value)}
            className={campoBase}
          />
        </div>

        <div>
          <label className={rotuloBase}>Horário de funcionamento</label>
          <input
            type="text"
            value={estrategia.horarioFuncionamento}
            onChange={(e) => alterar("horarioFuncionamento", e.target.value)}
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
    </div>
  );
}
