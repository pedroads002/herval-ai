"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { useLeads } from "@/components/ProvedorLeads";
import { clinicasIniciais } from "@/data/clinicas";
import { metasPadrao } from "@/data/metas";
import {
  baseDeLeads,
  dentroDaFaixa,
  montarAlertas,
  montarFollow,
  montarFunil,
  montarProducao,
  montarResumo,
  temAtividade,
  type Faixa,
  type LinhaFollow,
  type LinhaFunil,
  type LinhaProducao,
} from "@/lib/relatorios";
import { formatarMoeda, formatarNumero } from "@/lib/formato";
import PainelFilaAtendimento from "@/components/PainelFilaAtendimento";
import {
  comPercentual,
  estiloCampo,
  Kpi,
  Nome,
  Num,
  PontosDeAtencao,
  Tabela,
  Total,
  type Coluna,
} from "@/components/PecasDeRelatorio";

const abas = [
  { id: "funil", rotulo: "Funil Geral" },
  { id: "fila", rotulo: "Fila de Atendimento" },
] as const;

const presets = ["Hoje", "Últimos 7 dias", "Este mês", "Mês passado"] as const;
type Preset = (typeof presets)[number];

/** Meia-noite de hoje, para as contas de dia não escorregarem por hora. */
function inicioDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

const UM_DIA = 24 * 60 * 60 * 1000;

function diasAtrasDe(data: Date, hoje: Date) {
  return Math.round((hoje.getTime() - inicioDoDia(data).getTime()) / UM_DIA);
}

/**
 * Converte o preset numa faixa de dias. `ate` negativo é dia no futuro: "Este
 * mês" vai até o último dia do mês, e não até hoje, senão as consultas já
 * marcadas para os próximos dias ficariam de fora do mês que elas ocupam.
 */
function faixaDoPreset(preset: Preset, hoje: Date): Faixa {
  if (preset === "Hoje") return { de: 0, ate: 0 };
  if (preset === "Últimos 7 dias") return { de: 6, ate: 0 };

  if (preset === "Este mês") {
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return { de: diasAtrasDe(primeiro, hoje), ate: diasAtrasDe(ultimo, hoje) };
  }

  const primeiroDoPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const ultimoDoPassado = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  return {
    de: diasAtrasDe(primeiroDoPassado, hoje),
    ate: diasAtrasDe(ultimoDoPassado, hoje),
  };
}

/** "2026-08-13" a partir de um Date, sem passar por fuso. */
function paraCampo(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;
}

function deCampo(valor: string) {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

const relogio = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function PainelRelatorios() {
  const { tarefas, agendamentos } = useLeads();

  const [hoje, setHoje] = useState<Date | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [preset, setPreset] = useState<Preset>("Este mês");
  const [campoDe, setCampoDe] = useState("");
  const [campoAte, setCampoAte] = useState("");
  const [manual, setManual] = useState<Faixa | null>(null);
  const [clinicaId, setClinicaId] = useState<"todas" | number>("todas");
  const [mostrarSemAtividade, setMostrarSemAtividade] = useState(false);
  const [aba, setAba] = useState<(typeof abas)[number]["id"]>("funil");

  useEffect(() => {
    const agora = new Date();
    const dia = inicioDoDia(agora);
    setHoje(dia);
    setAtualizadoEm(agora);
    // Os campos começam refletindo o preset inicial ("Este mês"), que vai até
    // o último dia do mês para incluir as consultas já marcadas.
    const inicial = faixaDoPreset("Este mês", dia);
    setCampoDe(paraCampo(new Date(dia.getTime() - inicial.de * UM_DIA)));
    setCampoAte(paraCampo(new Date(dia.getTime() - inicial.ate * UM_DIA)));
  }, []);

  const faixa = useMemo<Faixa | null>(() => {
    if (!hoje) return null;
    return manual ?? faixaDoPreset(preset, hoje);
  }, [manual, preset, hoje]);

  const clinicasFiltradas = useMemo(
    () =>
      clinicaId === "todas"
        ? clinicasIniciais
        : clinicasIniciais.filter((c) => c.id === clinicaId),
    [clinicaId],
  );

  const dados = useMemo(() => {
    if (!faixa) return null;

    const leads = baseDeLeads(tarefas);
    const funil = montarFunil({
      leads,
      agendamentos,
      faixa,
      clinicas: clinicasFiltradas,
    });
    const producao = montarProducao({
      agendamentos,
      faixa,
      clinicas: clinicasFiltradas,
    });
    const follow = montarFollow({
      leads,
      agendamentos,
      faixa,
      clinicas: clinicasFiltradas,
    });

    const doPeriodo = agendamentos.filter(
      (a) =>
        clinicasFiltradas.some((c) => c.id === a.clinicaId) &&
        dentroDaFaixa(a.criadoHaDias, faixa),
    );

    return {
      funil,
      producao,
      follow,
      resumo: montarResumo(funil, producao, doPeriodo, faixa),
      alertas: montarAlertas(funil, producao, metasPadrao),
    };
  }, [faixa, tarefas, agendamentos, clinicasFiltradas]);

  if (!hoje || !faixa || !dados) {
    return (
      <p className="text-sm font-medium text-black/45">
        Carregando os relatórios...
      </p>
    );
  }

  const { funil, producao, follow, resumo, alertas } = dados;
  const producaoPorId = new Map(producao.map((l) => [l.clinica.id, l]));

  const visiveis = (linha: LinhaFunil) =>
    mostrarSemAtividade || temAtividade(linha, producaoPorId.get(linha.clinica.id));

  const idsVisiveis = new Set(
    funil.filter(visiveis).map((linha) => linha.clinica.id),
  );

  const funilVisivel = funil.filter(visiveis);
  const producaoVisivel = producao.filter((l) => idsVisiveis.has(l.clinica.id));
  const followVisivel = follow.filter((l) => idsVisiveis.has(l.clinica.id));
  const escondidas = funil.length - funilVisivel.length;

  function aplicarPreset(opcao: Preset) {
    if (!hoje) return;
    setPreset(opcao);
    setManual(null);
    const nova = faixaDoPreset(opcao, hoje);
    const inicio = new Date(hoje.getTime() - nova.de * UM_DIA);
    const fim = new Date(hoje.getTime() - nova.ate * UM_DIA);
    setCampoDe(paraCampo(inicio));
    setCampoAte(paraCampo(fim));
    setAtualizadoEm(new Date());
  }

  function atualizar() {
    if (!hoje || !campoDe || !campoAte) return;
    const de = diasAtrasDe(deCampo(campoDe), hoje);
    const ate = diasAtrasDe(deCampo(campoAte), hoje);
    setManual({ de: Math.max(de, ate), ate: Math.min(de, ate) });
    setAtualizadoEm(new Date());
  }

  return (
    <div className="space-y-8">
      {/* Abas */}
      <div className="inline-flex rounded-full border border-black/15 bg-herval-branco p-1">
        {abas.map((opcao) => {
          const ativa = opcao.id === aba;
          return (
            <button
              key={opcao.id}
              type="button"
              onClick={() => setAba(opcao.id)}
              aria-pressed={ativa}
              className={[
                "rounded-full px-5 py-2 text-sm font-bold transition-colors",
                ativa
                  ? "bg-herval-verde text-herval-preto"
                  : "text-black/60 hover:bg-black/5 hover:text-herval-preto",
              ].join(" ")}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <section className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <div className="inline-flex rounded-full border border-black/15 p-1">
              {presets.map((opcao) => {
                const ativo = !manual && opcao === preset;
                return (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => aplicarPreset(opcao)}
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

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-black/45">
                De
              </span>
              <input
                type="date"
                value={campoDe}
                onChange={(e) => setCampoDe(e.target.value)}
                className={estiloCampo}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-black/45">
                Até
              </span>
              <input
                type="date"
                value={campoAte}
                onChange={(e) => setCampoAte(e.target.value)}
                className={estiloCampo}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-black/45">
                Clínica
              </span>
              <select
                value={clinicaId}
                onChange={(e) =>
                  setClinicaId(
                    e.target.value === "todas" ? "todas" : Number(e.target.value),
                  )
                }
                className={estiloCampo}
              >
                <option value="todas">Todas as clínicas</option>
                {clinicasIniciais.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.ativa ? "" : " (pausada)"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-4">
            {atualizadoEm && (
              <span className="text-xs font-medium text-black/45">
                Atualizado às {relogio.format(atualizadoEm)}
              </span>
            )}
            <button
              type="button"
              onClick={atualizar}
              className="inline-flex items-center gap-2 rounded-full bg-herval-verde px-5 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {/* Vale para as duas abas: ambas listam as mesmas clínicas. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={mostrarSemAtividade}
          onClick={() => setMostrarSemAtividade((v) => !v)}
          className="inline-flex items-center gap-3 text-sm font-bold text-herval-preto"
        >
          <span
            className={[
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              mostrarSemAtividade ? "bg-herval-verde" : "bg-black/15",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 h-5 w-5 rounded-full bg-herval-branco shadow-card transition-all",
                mostrarSemAtividade ? "left-[1.375rem]" : "left-0.5",
              ].join(" ")}
            />
          </span>
          Mostrar clínicas sem atividade
        </button>

        {aba === "funil" && escondidas > 0 && !mostrarSemAtividade && (
          <span className="text-xs font-medium text-black/45">
            {escondidas}{" "}
            {escondidas === 1 ? "clínica escondida" : "clínicas escondidas"} por
            não ter movimento no período
          </span>
        )}
      </div>

      {aba === "fila" ? (
        <PainelFilaAtendimento
          faixa={faixa}
          clinicas={clinicasFiltradas}
          mostrarSemAtividade={mostrarSemAtividade}
        />
      ) : (
        <div className="space-y-8">
      {/* KPIs */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          rotulo="Leads de marketing"
          valor={formatarNumero(resumo.leadsMarketing)}
          detalhe={`${formatarNumero(resumo.qualificados)} qualificados`}
        />
        <Kpi
          rotulo="Agendados (funil)"
          valor={formatarNumero(resumo.agendadosFunil)}
          detalhe={`${formatarNumero(resumo.consultaFutura)} com consulta futura`}
        />
        <Kpi
          rotulo="Taxa de agendamento"
          valor={comPercentual(resumo.taxaAgendamento)}
          detalhe={`sobre ${formatarNumero(resumo.qualificados)} qualificados · meta ${metasPadrao.taxaAgendamento}%${
            resumo.inalcancaveis > 0
              ? ` · ${formatarNumero(resumo.inalcancaveis)} deles longe demais`
              : ""
          }`}
          alerta={
            resumo.taxaAgendamento !== null &&
            resumo.taxaAgendamento < metasPadrao.taxaAgendamento
          }
        />
        <Kpi
          rotulo="Produção de agendamentos"
          valor={formatarNumero(resumo.producao)}
          detalhe="pelo ato de agendar · remarcação conta de novo"
        />
        <Kpi
          rotulo="Show-rate da produção"
          valor={comPercentual(resumo.showRateProducao)}
          detalhe={`${formatarNumero(resumo.producaoCompareceu)} de ${formatarNumero(resumo.producaoAteAData)} consultas até a data`}
          alerta={
            resumo.showRateProducao !== null &&
            resumo.showRateProducao < metasPadrao.pisoShowRate
          }
        />
        <Kpi
          rotulo="Quem fechou o agendamento"
          valor={`${comPercentual(resumo.percentualIa)} IA`}
          detalhe={`${comPercentual(
            resumo.percentualIa === null ? null : 100 - resumo.percentualIa,
          )} CRC · ${formatarNumero(resumo.fechadosPelaIa)} × ${formatarNumero(resumo.fechadosPeloCrc)}`}
        />
      </div>

      {/* Fica fora do card para não esticar a linha inteira de indicadores. */}
      <p className="-mt-4 flex items-start gap-2 text-xs font-medium leading-relaxed text-black/50">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-bold text-herval-preto">
            Quem fechou o agendamento
          </span>{" "}
          mede quem travou o agendamento. A IA executa o processo (follow-up,
          lembrete, reagendamento) em 100% dos casos, mesmo quando quem fecha é
          o CRC.
        </span>
      </p>

      {/* Pontos de atenção */}
      <PontosDeAtencao
        alertas={alertas}
        visiveis={metasPadrao.alertasVisiveis}
        legenda={`Gerados a partir dos mesmos números das tabelas abaixo, comparados com as metas. Clínicas com menos de ${metasPadrao.amostraMinima} agendamentos no período ficam de fora: percentual sobre volume baixo gera alarme falso.`}
        vazio="Nenhuma clínica fora das metas no período selecionado."
      />

      {/* Tabela A */}
      <Tabela
        titulo="Funil de marketing (consultas do período)"
        legenda={
          'Conta os leads pela safra — o mês em que chegaram. As consultas contam pela data em que o paciente é atendido, venha o lead de qual safra vier. "Compareceu" é consulta que já aconteceu e o paciente esteve presente; consulta futura ainda não tem desfecho.' +
          (resumo.inalcancaveis > 0
            ? ` Dos qualificados do período, ${formatarNumero(resumo.inalcancaveis)} se perderam por "Localização distante": eram leads reais, mas sem como chegar na clínica, e por isso puxam a % de agendamento para baixo.`
            : "")
        }
        cabecalhos={[
          "Clínica",
          "Leads",
          "Desqual.",
          "Qualif.",
          "Agendados",
          "Até a data",
          "Consulta futura",
          "Compareceram",
          "% compar.",
          "% agend./qualif.",
          "R$ orçamento",
        ]}
        vazio={funilVisivel.length === 0}
      >
        {funilVisivel.map((linha) => (
          <tr key={linha.clinica.id} className="border-t border-black/[0.07]">
            <Nome clinica={linha.clinica.nome} ativa={linha.clinica.ativa} />
            <Num>{linha.leads}</Num>
            <Num>{linha.desqualificados}</Num>
            <Num>{linha.qualificados}</Num>
            <Num>{linha.agendados}</Num>
            <Num>{linha.ateAData}</Num>
            <Num>{linha.consultaFutura}</Num>
            <Num>{linha.compareceram}</Num>
            <Num>{comPercentual(linha.taxaComparecimento)}</Num>
            <Num
              alerta={
                linha.taxaAgendamento !== null &&
                linha.qualificados >= metasPadrao.amostraMinima &&
                linha.taxaAgendamento < metasPadrao.taxaAgendamento
              }
            >
              {comPercentual(linha.taxaAgendamento)}
            </Num>
            <Num>{formatarMoeda(linha.orcamento)}</Num>
          </tr>
        ))}
        <Total linhas={funilVisivel} colunas={colunasFunil} />
      </Tabela>

      {/* Tabela B */}
      <Tabela
        titulo="Follow — colheita de meses anteriores"
        legenda="Agendamentos feitos dentro do período para leads que chegaram antes dele. É o que a base antiga ainda rende: não precisa de campanha nova, precisa de follow-up. Vendas aqui são comparecimentos desses mesmos leads."
        cabecalhos={[
          "Clínica",
          "Agendados de safra anterior",
          "Vendas de safra anterior",
          "R$ de follow",
        ]}
        vazio={followVisivel.length === 0}
      >
        {followVisivel.map((linha) => (
          <tr key={linha.clinica.id} className="border-t border-black/[0.07]">
            <Nome clinica={linha.clinica.nome} ativa={linha.clinica.ativa} />
            <Num>{linha.agendadosDeSafraAnterior}</Num>
            <Num>{linha.vendasDeSafraAnterior}</Num>
            <Num>{formatarMoeda(linha.orcamento)}</Num>
          </tr>
        ))}
        <Total linhas={followVisivel} colunas={colunasFollow} />
      </Tabela>

      {/* Tabela C */}
      <Tabela
        titulo="Produção de agendamentos (pelo ato de agendar)"
        selo="Métrica oficial de comparecimento"
        legenda="Conta pela data em que a equipe marcou, não pela data da consulta. Se o paciente remarcou, conta de novo — é trabalho feito duas vezes. Show-rate é comparecimentos sobre as consultas dessa produção que já aconteceram; as futuras ficam de fora do cálculo."
        cabecalhos={[
          "Clínica",
          "Agendamentos",
          "Cancelados",
          "Consulta até a data",
          "Consulta futura",
          "Compareceram",
          "Show-rate",
        ]}
        vazio={producaoVisivel.length === 0}
      >
        {producaoVisivel.map((linha) => (
          <tr key={linha.clinica.id} className="border-t border-black/[0.07]">
            <Nome clinica={linha.clinica.nome} ativa={linha.clinica.ativa} />
            <Num>{linha.agendamentos}</Num>
            <Num>{linha.cancelados}</Num>
            <Num>{linha.consultaAteAData}</Num>
            <Num>{linha.consultaFutura}</Num>
            <Num>{linha.compareceram}</Num>
            <Num
              alerta={
                linha.showRate !== null &&
                linha.consultaAteAData >= metasPadrao.amostraMinima &&
                linha.showRate < metasPadrao.pisoShowRate
              }
            >
              {comPercentual(linha.showRate)}
            </Num>
          </tr>
        ))}
        <Total linhas={producaoVisivel} colunas={colunasProducao} />
      </Tabela>

      {/* Qual tabela usar */}
      <section className="rounded-card border border-black/10 bg-black/[0.03] p-8">
        <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
          <Info className="h-4 w-4" />
          Qual tabela usar?
        </h2>
        <dl className="mt-5 grid gap-5 lg:grid-cols-3">
          {[
            {
              titulo: "Funil de marketing",
              quando: "Para fechar o mês e avaliar campanha.",
              texto:
                "Responde se o investimento em anúncio virou consulta. Como conta pela data da consulta, o número muda quando um paciente antecipa ou adia.",
            },
            {
              titulo: "Produção de agendamentos",
              quando: "Para acompanhar a semana de trabalho.",
              texto:
                "Responde quanto a equipe marcou nesses dias e quanto disso se sustentou. É onde cancelamento e no-show aparecem primeiro, por isso é a métrica oficial de comparecimento.",
            },
            {
              titulo: "Follow",
              quando: "Para saber se a base antiga está rendendo.",
              texto:
                "Responde quanto do resultado veio de lead que já estava na casa. Follow alto com funil fraco quer dizer que a operação está segurando o mês sem mídia nova.",
            },
          ].map((item) => (
            <div key={item.titulo}>
              <dt className="text-sm font-extrabold text-herval-preto">
                {item.titulo}
              </dt>
              <dd className="mt-1 text-sm font-bold text-black/60">
                {item.quando}
              </dd>
              <dd className="mt-1.5 text-sm font-medium leading-relaxed text-black/55">
                {item.texto}
              </dd>
            </div>
          ))}
        </dl>
      </section>
        </div>
      )}
    </div>
  );
}

// --- Rodapés de total ------------------------------------------------------

const colunasFunil: Coluna<LinhaFunil>[] = [
  { tipo: "soma", valor: (l) => l.leads },
  { tipo: "soma", valor: (l) => l.desqualificados },
  { tipo: "soma", valor: (l) => l.qualificados },
  { tipo: "soma", valor: (l) => l.agendados },
  { tipo: "soma", valor: (l) => l.ateAData },
  { tipo: "soma", valor: (l) => l.consultaFutura },
  { tipo: "soma", valor: (l) => l.compareceram },
  { tipo: "taxa", parte: (l) => l.compareceram, total: (l) => l.ateAData },
  { tipo: "taxa", parte: (l) => l.agendadosDaSafra, total: (l) => l.qualificados },
  { tipo: "soma", valor: (l) => l.orcamento, moeda: true },
];

const colunasFollow: Coluna<LinhaFollow>[] = [
  { tipo: "soma", valor: (l) => l.agendadosDeSafraAnterior },
  { tipo: "soma", valor: (l) => l.vendasDeSafraAnterior },
  { tipo: "soma", valor: (l) => l.orcamento, moeda: true },
];

const colunasProducao: Coluna<LinhaProducao>[] = [
  { tipo: "soma", valor: (l) => l.agendamentos },
  { tipo: "soma", valor: (l) => l.cancelados },
  { tipo: "soma", valor: (l) => l.consultaAteAData },
  { tipo: "soma", valor: (l) => l.consultaFutura },
  { tipo: "soma", valor: (l) => l.compareceram },
  { tipo: "taxa", parte: (l) => l.compareceram, total: (l) => l.consultaAteAData },
];
