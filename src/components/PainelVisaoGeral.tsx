"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  dadosVisaoGeral,
  periodos,
  type Periodo,
} from "@/data/visaoGeral";
import { formatarNumero, percentual } from "@/lib/formato";

export default function PainelVisaoGeral() {
  const [periodo, setPeriodo] = useState<Periodo>("Diário");
  const dados = dadosVisaoGeral[periodo];

  const totalFunil = dados.funil[0]?.quantidade ?? 0;
  const maiorMotivo = Math.max(...dados.motivosPerda.map((m) => m.quantidade));

  return (
    <div className="space-y-10">
      {/* Filtro de período */}
      <div className="inline-flex rounded-full border border-black/15 bg-herval-branco p-1">
        {periodos.map((opcao) => {
          const ativo = opcao === periodo;
          return (
            <button
              key={opcao}
              type="button"
              onClick={() => setPeriodo(opcao)}
              aria-pressed={ativo}
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

      {/* KPIs */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {dados.kpis.map((kpi) => (
          <div
            key={kpi.id}
            className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-black/45">
              {kpi.rotulo}
            </p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-herval-preto">
              {kpi.valor}
            </p>

            {typeof kpi.variacao === "number" && (
              <span
                className={[
                  "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                  kpi.variacao >= 0
                    ? "bg-herval-verde text-herval-preto"
                    : "border border-black/25 text-black/70",
                ].join(" ")}
              >
                {kpi.variacao >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {kpi.variacao >= 0 ? "+" : ""}
                {kpi.variacao}% vs. período anterior
              </span>
            )}

            {kpi.detalhe && (
              <p className="mt-3 text-xs font-medium text-black/50">
                {kpi.detalhe}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Funil de conversão */}
        <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
          <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
            <span className="h-4 w-1 rounded-full bg-herval-verde" />
            Funil de conversão
          </h2>

          <div className="mt-7 space-y-5">
            {dados.funil.map((etapa, indice) => {
              const anterior = dados.funil[indice - 1];
              const larguraRelativa = percentual(etapa.quantidade, totalFunil);
              const queda = anterior
                ? 100 - percentual(etapa.quantidade, anterior.quantidade)
                : 0;

              return (
                <div key={etapa.etapa}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-bold text-herval-preto">
                      {etapa.etapa}
                    </span>
                    <span className="text-sm font-medium text-black/55">
                      <span className="font-extrabold text-herval-preto">
                        {formatarNumero(etapa.quantidade)}
                      </span>{" "}
                      · {larguraRelativa}% do total
                    </span>
                  </div>

                  <div className="mt-2 h-9 w-full overflow-hidden rounded-controle bg-black/5">
                    <div
                      className="h-full rounded-controle bg-herval-verde"
                      style={{ width: `${Math.max(larguraRelativa, 3)}%` }}
                    />
                  </div>

                  {anterior && (
                    <p className="mt-1.5 text-xs font-medium text-black/50">
                      Queda de{" "}
                      <span className="font-extrabold text-herval-preto">
                        {queda}%
                      </span>{" "}
                      em relação a {anterior.etapa.toLowerCase()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Motivos de perda */}
        <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
          <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
            <span className="h-4 w-1 rounded-full bg-herval-verde" />
            Motivos de perda
          </h2>

          <ul className="mt-7 space-y-4">
            {dados.motivosPerda.map((motivo) => (
              <li key={motivo.motivo}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-black/70">
                    {motivo.motivo}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-herval-preto">
                    {formatarNumero(motivo.quantidade)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-herval-preto"
                    style={{
                      width: `${percentual(motivo.quantidade, maiorMotivo)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
