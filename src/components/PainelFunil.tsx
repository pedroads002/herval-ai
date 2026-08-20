"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Move,
  RotateCcw,
  Search,
  Trophy,
  X,
} from "lucide-react";
import EtiquetaResponsavel from "@/components/EtiquetaResponsavel";
import {
  useLeads,
  type DadosDaMovimentacao,
} from "@/components/ProvedorLeads";
import MenuDeEtapa, { type PassoDoMenu } from "@/components/MenuDeEtapa";
import { etapasFunil, type EtapaFunil } from "@/data/leads";
import type { Tarefa } from "@/data/tarefas";
import { formatarMoeda } from "@/lib/formato";

const periodos = ["Todos", "Este mês", "Chegaram hoje"] as const;
type Periodo = (typeof periodos)[number];

function dentroDoPeriodo(dias: number, periodo: Periodo) {
  if (periodo === "Chegaram hoje") return dias === 0;
  if (periodo === "Este mês") return dias <= 30;
  return true;
}

export default function PainelFunil() {
  const { tarefas, moverEtapa } = useLeads();
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("Todos");
  // Card com o menu "Mover para" aberto.
  const [movendo, setMovendo] = useState<number | null>(null);
  /**
   * Mover é livre, mas duas etapas cobram informação antes de aceitar: Venda
   * Ganha pede o valor e Venda Perdida pede o motivo. Daí o menu ter passos.
   */
  const [passo, setPasso] = useState<PassoDoMenu>("etapa");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return tarefas.filter(
      (t) =>
        dentroDoPeriodo(t.diasAtras, periodo) &&
        (termo === "" ||
          t.lead.toLowerCase().includes(termo) ||
          t.telefone.toLowerCase().includes(termo)),
    );
  }, [tarefas, busca, periodo]);

  const colunas = useMemo(
    () =>
      etapasFunil.map((etapa) => ({
        etapa,
        cards: visiveis.filter((t) => t.etapa === etapa),
      })),
    [visiveis],
  );

  function abrirMenu(id: number) {
    setMovendo((atual) => (atual === id ? null : id));
    setPasso("etapa");
  }

  function mover(id: number, etapa: EtapaFunil, dados?: DadosDaMovimentacao) {
    moverEtapa(id, etapa, dados);
    setMovendo(null);
    setPasso("etapa");
  }

  return (
    <div className="space-y-7">
      {/* Busca e período */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full rounded-full border border-black/15 bg-herval-branco py-3 pl-11 pr-4 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
          />
        </div>

        <div className="inline-flex shrink-0 rounded-full border border-black/15 bg-herval-branco p-1">
          {periodos.map((opcao) => {
            const ativo = opcao === periodo;
            return (
              <button
                key={opcao}
                type="button"
                onClick={() => setPeriodo(opcao)}
                aria-pressed={ativo}
                className={[
                  "rounded-full px-4 py-2 text-sm font-bold transition-colors",
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
      </div>

      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">
          {visiveis.length}
        </span>{" "}
        {visiveis.length === 1 ? "lead exibido" : "leads exibidos"} de{" "}
        <span className="font-extrabold text-herval-preto">
          {tarefas.length}
        </span>{" "}
        na base · {etapasFunil.length} etapas. É normal etapa ficar vazia.
      </p>

      {/* Quadro */}
      <div className="-mx-6 overflow-x-auto px-6 pb-4 md:-mx-10 md:px-10">
        <div className="flex gap-4">
          {colunas.map(({ etapa, cards }) => (
            <section
              key={etapa}
              className="flex w-64 shrink-0 flex-col rounded-card border border-black/10 bg-black/[0.03]"
            >
              <header className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3.5">
                <h2 className="text-sm font-extrabold tracking-tight text-herval-preto">
                  {etapa}
                </h2>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums",
                    cards.length > 0
                      ? "bg-herval-verde text-herval-preto"
                      : "border border-black/15 text-black/40",
                  ].join(" ")}
                >
                  {cards.length}
                </span>
              </header>

              <div className="flex-1 space-y-3 p-3">
                {cards.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs font-medium text-black/35">
                    Nenhum lead nesta etapa.
                  </p>
                )}

                {cards.map((tarefa) => (
                  <Cartao
                    key={tarefa.id}
                    tarefa={tarefa}
                    menuAberto={movendo === tarefa.id}
                    passo={passo}
                    aoAbrirMenu={() => abrirMenu(tarefa.id)}
                    aoPedirPasso={setPasso}
                    aoMover={(destino, dados) =>
                      mover(tarefa.id, destino, dados)
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Passos do menu de mover: a lista, ou o campo que a etapa de destino exige. */

function Cartao({
  tarefa,
  menuAberto,
  passo,
  aoAbrirMenu,
  aoPedirPasso,
  aoMover,
}: {
  tarefa: Tarefa;
  menuAberto: boolean;
  passo: PassoDoMenu;
  aoAbrirMenu: () => void;
  aoPedirPasso: (passo: PassoDoMenu) => void;
  aoMover: (etapa: EtapaFunil, dados?: DadosDaMovimentacao) => void;
}) {
  return (
    <article className="rounded-controle border border-black/10 bg-herval-branco p-3.5 shadow-card">
      <h3 className="text-sm font-bold text-herval-preto">{tarefa.lead}</h3>
      <p className="mt-0.5 text-xs font-medium text-black/45">
        {tarefa.telefone}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <EtiquetaResponsavel
          responsavel={tarefa.responsavel}
          destacado={tarefa.tipo === "alerta-humano"}
        />
        <span className="rounded-full bg-herval-verde/15 px-2.5 py-1 text-[11px] font-bold text-herval-preto">
          {tarefa.origem}
        </span>
        {(tarefa.remarcacoes ?? 0) > 0 && (
          <span
            title="Consulta remarcada depois de uma falta"
            className="inline-flex items-center gap-1 rounded-full border border-black/20 px-2.5 py-1 text-[11px] font-bold text-black/70"
          >
            <RotateCcw className="h-3 w-3" />
            {tarefa.remarcacoes}
            {tarefa.remarcacoes === 1 ? " remarcação" : " remarcações"}
          </span>
        )}
      </div>

      {tarefa.motivoPerda && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-herval-preto px-2.5 py-1 text-[11px] font-bold text-herval-branco">
          <X className="h-3 w-3" />
          {tarefa.motivoPerda}
        </p>
      )}

      {tarefa.valorVenda !== undefined && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-2.5 py-1 text-[11px] font-extrabold text-herval-preto">
          <Trophy className="h-3 w-3" />
          {formatarMoeda(tarefa.valorVenda)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3">
        {/* Ponto de entrada do atendimento: o card do lead, sem lista nova. */}
        <Link
          href={`/atendimento/${tarefa.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-black/55 transition-colors hover:text-herval-preto"
        >
          Atender
          <ExternalLink className="h-3 w-3" />
        </Link>

        <button
          type="button"
          onClick={aoAbrirMenu}
          aria-expanded={menuAberto}
          className={[
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
            menuAberto
              ? "bg-herval-preto text-herval-branco"
              : "border border-black/15 text-black/65 hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto",
          ].join(" ")}
        >
          <Move className="h-3 w-3" />
          Mover
        </button>
      </div>

      {menuAberto && (
        <div className="mt-3 rounded-controle bg-black/[0.04] p-2.5">
          <MenuDeEtapa
            etapaAtual={tarefa.etapa}
            passo={passo}
            aoPedirPasso={aoPedirPasso}
            aoMover={aoMover}
          />
        </div>
      )}
    </article>
  );
}
