"use client";

import { useState } from "react";
import { AlertTriangle, TriangleAlert } from "lucide-react";
import { formatarMoeda, formatarNumero } from "@/lib/formato";
import type { Alerta } from "@/lib/relatorios";

/**
 * Peças visuais compartilhadas pelas abas de Relatórios. Ficam fora das telas
 * porque as duas abas precisam ser lidas do mesmo jeito: card, tabela e alerta
 * com aparência diferente entre abas fariam parecer que medem coisas
 * diferentes.
 */

export const estiloCampo =
  "rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

export function comPercentual(valor: number | null) {
  return valor === null ? "—" : `${valor}%`;
}

export function razao(parte: number, total: number) {
  return total === 0 ? "—" : `${Math.round((parte / total) * 100)}%`;
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  alerta = false,
  selo,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
  /** Marca um card que não obedece ao filtro de período. */
  selo?: string;
}) {
  return (
    <div className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-black/45">
          {rotulo}
        </p>
        {selo && (
          <span className="shrink-0 rounded-full bg-herval-preto px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-herval-branco">
            {selo}
          </span>
        )}
      </div>
      <p
        className={[
          "mt-3 text-3xl font-extrabold tracking-tight",
          alerta ? "text-herval-vermelho" : "text-herval-preto",
        ].join(" ")}
      >
        {valor}
      </p>
      {detalhe && (
        <p className="mt-3 text-xs font-medium leading-relaxed text-black/50">
          {detalhe}
        </p>
      )}
    </div>
  );
}

export function Tabela({
  titulo,
  legenda,
  selo,
  cabecalhos,
  vazio,
  children,
}: {
  titulo: string;
  legenda: string;
  selo?: string;
  cabecalhos: string[];
  vazio: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-black/10 bg-herval-branco shadow-card">
      <div className="border-b border-black/10 p-8 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
            <span className="h-4 w-1 rounded-full bg-herval-verde" />
            {titulo}
          </h2>
          {selo && (
            <span className="rounded-full bg-herval-verde px-3 py-1 text-[11px] font-extrabold text-herval-preto">
              {selo}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-4xl text-xs font-medium leading-relaxed text-black/50">
          {legenda}
        </p>
      </div>

      {vazio ? (
        <p className="px-8 py-10 text-center text-sm font-medium text-black/45">
          Nenhuma clínica com movimento no período. Ligue &quot;Mostrar clínicas
          sem atividade&quot; para ver todas.
        </p>
      ) : (
        // A primeira coluna fica presa para o nome da clínica não sumir ao
        // rolar de lado: são muitas colunas.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="bg-black/[0.03]">
                {cabecalhos.map((texto, indice) => (
                  <th
                    key={texto}
                    scope="col"
                    className={[
                      "whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-black/45",
                      indice === 0
                        ? "sticky left-0 z-10 bg-[#F5F5F5] text-left"
                        : "text-right",
                    ].join(" ")}
                  >
                    {texto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Nome({ clinica, ativa }: { clinica: string; ativa: boolean }) {
  return (
    <th
      scope="row"
      className="sticky left-0 z-10 whitespace-nowrap bg-herval-branco px-4 py-3 text-left text-sm font-bold text-herval-preto"
    >
      {clinica}
      {!ativa && (
        <span className="ml-2 rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black/45">
          Pausada
        </span>
      )}
    </th>
  );
}

export function Num({
  children,
  alerta = false,
  forte = false,
}: {
  children: React.ReactNode;
  alerta?: boolean;
  forte?: boolean;
}) {
  return (
    <td
      className={[
        "whitespace-nowrap px-4 py-3 text-right tabular-nums",
        alerta
          ? "font-extrabold text-herval-vermelho"
          : forte
            ? "font-extrabold text-herval-preto"
            : "font-medium text-black/70",
      ].join(" ")}
    >
      {children}
    </td>
  );
}

/**
 * Como preencher cada coluna no rodapé de total. Colunas de percentual não
 * somam: recebem `taxa`, que refaz a conta sobre os totais das colunas que a
 * compõem — somar percentual daria média de média.
 *
 * `texto` é para coluna que não tem total possível, como uma mediana: a
 * mediana do conjunto não sai das medianas das linhas.
 */
export type Coluna<T> =
  | { tipo: "soma"; valor: (linha: T) => number; moeda?: boolean }
  | { tipo: "taxa"; parte: (linha: T) => number; total: (linha: T) => number }
  | { tipo: "texto"; valor: () => string };

export function Total<T>({
  linhas,
  colunas,
}: {
  linhas: T[];
  colunas: Coluna<T>[];
}) {
  if (linhas.length === 0) return null;

  const soma = (campo: (linha: T) => number) =>
    linhas.reduce((total, linha) => total + campo(linha), 0);

  return (
    <tr className="border-t-2 border-black/15 bg-black/[0.02]">
      <th
        scope="row"
        className="sticky left-0 z-10 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-left text-sm font-extrabold text-herval-preto"
      >
        Total
      </th>
      {colunas.map((coluna, indice) => (
        <Num key={indice} forte>
          {coluna.tipo === "taxa"
            ? razao(soma(coluna.parte), soma(coluna.total))
            : coluna.tipo === "texto"
              ? coluna.valor()
              : coluna.moeda
                ? formatarMoeda(soma(coluna.valor))
                : formatarNumero(soma(coluna.valor))}
        </Num>
      ))}
    </tr>
  );
}

/**
 * O bloco de alertas, igual nas duas abas: contador, os mais graves primeiro e
 * o resto atrás de um botão. Mostrar trinta alertas de uma vez é o mesmo que
 * não mostrar nenhum.
 */
export function PontosDeAtencao({
  alertas,
  visiveis,
  legenda,
  vazio,
}: {
  alertas: Alerta[];
  visiveis: number;
  legenda: string;
  vazio: string;
}) {
  const [todos, setTodos] = useState(false);
  const mostrados = todos ? alertas : alertas.slice(0, visiveis);

  return (
    <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
          <span className="h-4 w-1 rounded-full bg-herval-verde" />
          Pontos de atenção
        </h2>
        <span
          className={[
            "rounded-full px-3 py-1 text-xs font-extrabold",
            alertas.length > 0
              ? "bg-herval-preto text-herval-branco"
              : "border border-black/15 text-black/45",
          ].join(" ")}
        >
          Ação necessária: {alertas.length}
        </span>
      </div>

      <p className="mt-2 text-xs font-medium leading-relaxed text-black/50">
        {legenda}
      </p>

      {alertas.length === 0 ? (
        <p className="mt-6 rounded-controle bg-black/[0.03] px-4 py-4 text-sm font-medium text-black/60">
          {vazio}
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {mostrados.map((alerta) => {
              const critico = alerta.severidade === "critico";
              return (
                <li
                  key={alerta.id}
                  className={[
                    "flex items-start gap-3 rounded-controle border-l-4 bg-black/[0.02] px-4 py-3.5",
                    critico
                      ? "border-l-herval-vermelho"
                      : "border-l-herval-atencao",
                  ].join(" ")}
                >
                  {critico ? (
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-herval-vermelho" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-herval-atencao" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-herval-preto">
                      {alerta.clinica}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-black/65">
                      {alerta.problema}
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-herval-preto">
                      {alerta.acao}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {alertas.length > visiveis && (
            <button
              type="button"
              onClick={() => setTodos((v) => !v)}
              aria-expanded={todos}
              className="mt-4 text-sm font-bold text-black/60 underline decoration-black/20 underline-offset-4 transition-colors hover:text-herval-preto"
            >
              {todos
                ? "Mostrar só os mais críticos"
                : `+${alertas.length - visiveis} outros alertas no período`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
