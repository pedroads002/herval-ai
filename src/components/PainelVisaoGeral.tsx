"use client";

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  dentroDoPeriodo,
  descricaoDoPeriodo,
  faixaDoPeriodo,
  periodos,
  type Periodo,
} from "@/data/visaoGeral";
import { useLeads } from "@/components/ProvedorLeads";
import { motivosDePerda } from "@/data/tarefas";
import {
  baseDeLeads,
  faixaAnterior,
  montarConversao,
  montarFunil,
  montarProducao,
  montarResumo,
  variacao,
  type Faixa,
  type ResumoGeral,
} from "@/lib/relatorios";
import { formatarNumero, percentual } from "@/lib/formato";

export default function PainelVisaoGeral() {
  const [periodo, setPeriodo] = useState<Periodo>("Diário");
  const { tarefas, agendamentos } = useLeads();

  // Os motivos saem dos próprios cards em "Venda Perdida" no Funil, e não de
  // uma lista fixa: mover um lead para lá muda esta contagem na hora.
  const perdidos = useMemo(
    () => tarefas.filter((t) => t.etapa === "Venda Perdida"),
    [tarefas],
  );

  const contagemMotivos = useMemo(
    () =>
      motivosDePerda
        .map((motivo) => ({
          motivo,
          quantidade: perdidos.filter((t) => t.motivoPerda === motivo).length,
        }))
        .sort((a, b) => b.quantidade - a.quantidade),
    [perdidos],
  );

  /**
   * Os números do período e os do período anterior saem das mesmas funções dos
   * Relatórios — a única diferença entre as duas telas é a faixa de dias que
   * cada uma monta.
   */
  const dados = useMemo(() => {
    const leads = baseDeLeads(tarefas);
    const faixa = faixaDoPeriodo(periodo);

    const resumoDe = (recorte: Faixa): ResumoGeral => {
      const funil = montarFunil({ leads, agendamentos, faixa: recorte });
      const producao = montarProducao({ agendamentos, faixa: recorte });
      return montarResumo(funil, producao, agendamentos, recorte);
    };

    return {
      atual: resumoDe(faixa),
      anterior: resumoDe(faixaAnterior(faixa)),
      conversao: montarConversao({ leads, agendamentos, faixa }),
    };
  }, [tarefas, agendamentos, periodo]);

  const { atual, anterior, conversao } = dados;
  const quando = descricaoDoPeriodo[periodo];

  const totalFunil = conversao[0]?.quantidade ?? 0;
  const maiorMotivo = Math.max(1, ...contagemMotivos.map((m) => m.quantidade));

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
        <Kpi
          rotulo="Leads de marketing"
          valor={formatarNumero(atual.leadsMarketing)}
          variacao={variacao(atual.leadsMarketing, anterior.leadsMarketing)}
          detalhe={`de campanha paga · ${quando}`}
        />
        <Kpi
          rotulo="Agendamentos"
          valor={formatarNumero(atual.producao)}
          variacao={variacao(atual.producao, anterior.producao)}
          detalhe="pelo ato de agendar · remarcação conta de novo"
        />
        <Kpi
          rotulo="Taxa de reagendamento"
          valor={comPercentual(atual.taxaReagendamento)}
          variacao={pontos(atual.taxaReagendamento, anterior.taxaReagendamento)}
          emPontos
          // Aqui subir é ruim: é consulta que precisou ser marcada de novo.
          quantoMaiorPior
          detalhe={`${formatarNumero(atual.remarcacoes)} de ${formatarNumero(atual.producao)} agendamentos`}
        />
        <Kpi
          rotulo="Taxa de no-show"
          valor={comPercentual(atual.taxaNoShow)}
          variacao={pontos(atual.taxaNoShow, anterior.taxaNoShow)}
          emPontos
          quantoMaiorPior
          detalhe={`${formatarNumero(atual.faltas)} faltas em ${formatarNumero(atual.producaoAteAData)} consultas até a data`}
        />
        <Kpi
          rotulo="Origem do agendamento"
          valor={`${comPercentual(atual.percentualIa)} IA`}
          variacao={pontos(atual.percentualIa, anterior.percentualIa)}
          emPontos
          detalhe={`${comPercentual(
            atual.percentualIa === null ? null : 100 - atual.percentualIa,
          )} CRC · ${formatarNumero(atual.fechadosPelaIa)} × ${formatarNumero(atual.fechadosPeloCrc)}`}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Funil de conversão */}
        <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
          <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
            <span className="h-4 w-1 rounded-full bg-herval-verde" />
            Funil de conversão
          </h2>

          <p className="mt-2 text-xs font-medium leading-relaxed text-black/50">
            Sempre o mesmo grupo de gente: os leads de campanha que chegaram{" "}
            {dentroDoPeriodo[periodo]}, acompanhados até onde cada um chegou.
            Cada degrau está
            dentro do anterior, por isso a queda é queda de verdade.
          </p>

          <div className="mt-7 space-y-5">
            {conversao.map((etapa, indice) => {
              const anteriorDegrau = conversao[indice - 1];
              const larguraRelativa = percentual(etapa.quantidade, totalFunil);
              const queda = anteriorDegrau
                ? 100 - percentual(etapa.quantidade, anteriorDegrau.quantidade)
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

                  {anteriorDegrau && (
                    <p className="mt-1.5 text-xs font-medium text-black/50">
                      Queda de{" "}
                      <span className="font-extrabold text-herval-preto">
                        {queda}%
                      </span>{" "}
                      em relação a {anteriorDegrau.etapa.toLowerCase()}
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

          {/* Deixa claro que esta contagem não é do período selecionado, para
              não ser comparada com o funil de conversão. */}
          <p className="mt-2 text-xs font-medium text-black/50">
            Com base nos{" "}
            <span className="font-extrabold text-herval-preto">
              {perdidos.length}
            </span>{" "}
            {perdidos.length === 1
              ? "lead atualmente em"
              : "leads atualmente em"}{" "}
            &quot;Venda Perdida&quot; no Funil. Não muda com o filtro de
            período, diferente do funil de conversão.
          </p>

          <ul className="mt-7 space-y-4">
            {contagemMotivos.map((motivo) => (
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

// --- Peças da tela ---------------------------------------------------------

function comPercentual(valor: number | null) {
  return valor === null ? "—" : `${valor}%`;
}

/**
 * Diferença entre dois percentuais, em pontos. Percentual sobre percentual
 * ("a taxa subiu 20%") confunde: 10% para 12% é subir 2 pontos, não 20%.
 */
function pontos(agora: number | null, antes: number | null) {
  if (agora === null || antes === null) return null;
  return agora - antes;
}

function Kpi({
  rotulo,
  valor,
  variacao: diferenca,
  emPontos = false,
  quantoMaiorPior = false,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  variacao: number | null;
  emPontos?: boolean;
  quantoMaiorPior?: boolean;
  detalhe?: string;
}) {
  const subiu = (diferenca ?? 0) >= 0;
  const bom = quantoMaiorPior ? !subiu : subiu;

  return (
    <div className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-black/45">
        {rotulo}
      </p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-herval-preto">
        {valor}
      </p>

      {diferenca !== null && (
        <span
          className={[
            "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
            bom
              ? "bg-herval-verde text-herval-preto"
              : "border border-black/25 text-black/70",
          ].join(" ")}
        >
          {subiu ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {subiu ? "+" : ""}
          {diferenca}
          {emPontos ? " p.p." : "%"} vs. período anterior
        </span>
      )}

      {detalhe && (
        <p className="mt-3 text-xs font-medium text-black/50">{detalhe}</p>
      )}
    </div>
  );
}
