import Link from "next/link";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";
import { variacao } from "@/lib/relatorios";
import { formatarNumero, percentual } from "@/lib/formato";
import {
  descricaoDoIntervalo,
  type PeriodoEscolhido,
} from "@/lib/visaoGeral/periodo";
import type { DadosDaVisaoGeral } from "@/lib/dados/visaoGeral";

/**
 * A Visão Geral.
 *
 * Deixou de ser componente de navegador: os números vêm prontos do servidor,
 * lidos do banco em `lib/dados/visaoGeral.ts`. O que era estado aqui dentro
 * (período, clínica) virou endereço, e mora em `FiltrosDaVisaoGeral`.
 *
 * Nada de aparência mudou: as classes dos cards, das barras e dos selos são as
 * mesmas de antes.
 */
export default function PainelVisaoGeral({
  dados,
  periodo,
}: {
  dados: DadosDaVisaoGeral;
  periodo: PeriodoEscolhido;
}) {
  if (dados.falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-medium text-black/60">{dados.falha}</p>
      </div>
    );
  }

  const { atual, anterior, conversao, motivos, totalPerdidos, alertas } = dados;
  const quando = descricaoDoIntervalo(periodo);

  const totalFunil = conversao[0]?.quantidade ?? 0;
  const maiorMotivo = Math.max(1, ...motivos.map((m) => m.quantidade));

  return (
    <div className="space-y-10">
      {/* KPIs */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi
          rotulo="Leads"
          valor={formatarNumero(atual.leads)}
          variacao={variacao(atual.leads, anterior.leads)}
          detalhe={`entraram na base ${quando}`}
        />
        <Kpi
          rotulo="Agendamentos"
          valor={formatarNumero(atual.agendamentos)}
          variacao={variacao(atual.agendamentos, anterior.agendamentos)}
          detalhe="pelo ato de agendar · remarcação conta de novo"
        />
        <Kpi
          rotulo="Comparecimentos"
          valor={formatarNumero(atual.comparecimentos)}
          variacao={variacao(atual.comparecimentos, anterior.comparecimentos)}
          detalhe={`de ${formatarNumero(atual.consultasAteAData)} consultas desses agendamentos que já aconteceram`}
        />
        <Kpi
          rotulo="Vendas"
          valor={formatarNumero(atual.vendas)}
          variacao={variacao(atual.vendas, anterior.vendas)}
          detalhe="leads do período que hoje estão em Venda Ganha"
        />
        <SemFonteDeDados />
      </div>

      {/* Indicadores secundários */}
      <section className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
        <div className="grid gap-7 sm:grid-cols-3">
          <Indicador
            rotulo="Taxa de no-show"
            valor={comPercentual(atual.taxaNoShow)}
            variacao={pontos(atual.taxaNoShow, anterior.taxaNoShow)}
            // Aqui subir é ruim: é paciente que marcou e não apareceu.
            quantoMaiorPior
            detalhe={`${formatarNumero(atual.faltas)} faltas em ${formatarNumero(atual.consultasAteAData)} consultas até a data`}
          />
          <Indicador
            rotulo="Taxa de reagendamento"
            valor={comPercentual(atual.taxaReagendamento)}
            variacao={pontos(
              atual.taxaReagendamento,
              anterior.taxaReagendamento,
            )}
            quantoMaiorPior
            detalhe={`${formatarNumero(atual.remarcacoes)} de ${formatarNumero(atual.agendamentos)} agendamentos precisaram ser marcados de novo`}
          />
          <Indicador
            rotulo="Origem dos agendamentos"
            valor={`${comPercentual(atual.percentualIa)} IA`}
            variacao={pontos(atual.percentualIa, anterior.percentualIa)}
            detalhe={`${comPercentual(
              atual.percentualIa === null ? null : 100 - atual.percentualIa,
            )} CRC · ${formatarNumero(atual.fechadosPelaIa)} × ${formatarNumero(atual.fechadosPeloCrc)}`}
          />
        </div>
      </section>

      {/* Pontos de atenção */}
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
          Comparação entre o que o banco registrou e as metas da operação. Nada
          aqui é opinião nem leitura de IA: cada ponto é um número batendo em um
          limiar. Taxa só vira alerta com amostra mínima, para três consultas
          não gerarem alarme.
        </p>

        {alertas.length === 0 ? (
          <p className="mt-6 rounded-controle bg-black/[0.03] px-4 py-4 text-sm font-medium text-black/60">
            Nenhum ponto crítico identificado neste período.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {alertas.map((alerta) => {
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
                    <p className="text-sm font-medium text-black/65">
                      {alerta.problema}
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-herval-preto">
                      {alerta.acao}
                    </p>
                    {alerta.destino && (
                      <Link
                        href={alerta.destino.href}
                        className="mt-1.5 inline-block text-sm font-bold text-herval-preto underline decoration-herval-verde decoration-2 underline-offset-2 hover:text-black/70"
                      >
                        {alerta.destino.texto}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Funil de conversão */}
        <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
          <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
            <span className="h-4 w-1 rounded-full bg-herval-verde" />
            Funil de conversão
          </h2>

          <p className="mt-2 text-xs font-medium leading-relaxed text-black/50">
            Sempre o mesmo grupo de gente: os leads que chegaram {quando},
            acompanhados até onde cada um chegou. Cada degrau está dentro do
            anterior, por isso a queda é queda de verdade.
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
              {totalPerdidos}
            </span>{" "}
            {totalPerdidos === 1 ? "lead atualmente em" : "leads atualmente em"}{" "}
            &quot;Venda Perdida&quot; no Funil. Não muda com o filtro de
            período, diferente do funil de conversão.
          </p>

          <ul className="mt-7 space-y-4">
            {motivos.map((motivo) => (
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

function Variacao({
  diferenca,
  emPontos,
  quantoMaiorPior,
}: {
  diferenca: number;
  emPontos: boolean;
  quantoMaiorPior: boolean;
}) {
  const subiu = diferenca >= 0;
  const bom = quantoMaiorPior ? !subiu : subiu;

  return (
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
  );
}

function Kpi({
  rotulo,
  valor,
  variacao: diferenca,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  variacao: number | null;
  detalhe?: string;
}) {
  return (
    <div className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-black/45">
        {rotulo}
      </p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-herval-preto">
        {valor}
      </p>

      {diferenca !== null && (
        <Variacao
          diferenca={diferenca}
          emPontos={false}
          quantoMaiorPior={false}
        />
      )}

      {detalhe && (
        <p className="mt-3 text-xs font-medium text-black/50">{detalhe}</p>
      )}
    </div>
  );
}

/**
 * O lugar do Faturamento.
 *
 * Fica reservado, e vazio, de propósito. Não existe em nenhuma tabela o valor de
 * uma venda realizada — o único campo de valor do sistema é a faixa aproximada
 * da tabela de preços da clínica, que é referência, não venda. Então o card não
 * mostra zero (que seria mentira) nem desaparece (que faria parecer que ninguém
 * pensou nisso): ele diz o que falta.
 */
function SemFonteDeDados() {
  return (
    <div className="rounded-card border border-dashed border-black/20 bg-black/[0.02] p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-black/45">
        Faturamento
      </p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-black/25">
        —
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/20 px-2.5 py-1 text-[11px] font-bold text-black/50">
        Sem fonte de dados ainda
      </span>
      <p className="mt-3 text-xs font-medium text-black/50">
        Nenhuma tabela guarda o valor de venda realizada. Enquanto não guardar,
        este número não existe.
      </p>
    </div>
  );
}

/** Indicador de segunda linha: mesma linguagem do KPI, em tamanho menor. */
function Indicador({
  rotulo,
  valor,
  variacao: diferenca,
  quantoMaiorPior = false,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  variacao: number | null;
  quantoMaiorPior?: boolean;
  detalhe: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-black/45">
        {rotulo}
      </p>
      <p className="mt-2 text-xl font-extrabold tracking-tight text-herval-preto">
        {valor}
      </p>

      {diferenca !== null && (
        <Variacao
          diferenca={diferenca}
          emPontos
          quantoMaiorPior={quantoMaiorPior}
        />
      )}

      <p className="mt-3 text-xs font-medium text-black/50">{detalhe}</p>
    </div>
  );
}
