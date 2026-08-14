"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, RefreshCw, TriangleAlert } from "lucide-react";
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

const abas = [
  { id: "funil", rotulo: "Funil Geral", disponivel: true },
  { id: "fila", rotulo: "Fila de Atendimento", disponivel: false },
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
  const [todosOsAlertas, setTodosOsAlertas] = useState(false);
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

  const alertasVisiveis = todosOsAlertas
    ? alertas
    : alertas.slice(0, metasPadrao.alertasVisiveis);

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
              disabled={!opcao.disponivel}
              onClick={() => opcao.disponivel && setAba(opcao.id)}
              aria-pressed={ativa}
              title={
                opcao.disponivel
                  ? undefined
                  : "Em breve: dados da fila de atendimento do CRC"
              }
              className={[
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors",
                ativa
                  ? "bg-herval-verde text-herval-preto"
                  : opcao.disponivel
                    ? "text-black/60 hover:bg-black/5 hover:text-herval-preto"
                    : "cursor-not-allowed text-black/30",
              ].join(" ")}
            >
              {opcao.rotulo}
              {!opcao.disponivel && (
                <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Em breve
                </span>
              )}
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

        <p className="mt-2 text-xs font-medium text-black/50">
          Gerados a partir dos mesmos números das tabelas abaixo, comparados com
          as metas. Clínicas com menos de {metasPadrao.amostraMinima}{" "}
          agendamentos no período ficam de fora: percentual sobre volume baixo
          gera alarme falso.
        </p>

        {alertas.length === 0 ? (
          <p className="mt-6 rounded-controle bg-black/[0.03] px-4 py-4 text-sm font-medium text-black/60">
            Nenhuma clínica fora das metas no período selecionado.
          </p>
        ) : (
          <>
            <ul className="mt-6 space-y-3">
              {alertasVisiveis.map((alerta) => {
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

            {alertas.length > metasPadrao.alertasVisiveis && (
              <button
                type="button"
                onClick={() => setTodosOsAlertas((v) => !v)}
                aria-expanded={todosOsAlertas}
                className="mt-4 text-sm font-bold text-black/60 underline decoration-black/20 underline-offset-4 transition-colors hover:text-herval-preto"
              >
                {todosOsAlertas
                  ? "Mostrar só os mais críticos"
                  : `+${alertas.length - metasPadrao.alertasVisiveis} outros alertas no período`}
              </button>
            )}
          </>
        )}
      </section>

      {/* Toggle de clínicas sem atividade */}
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

        {escondidas > 0 && !mostrarSemAtividade && (
          <span className="text-xs font-medium text-black/45">
            {escondidas} {escondidas === 1 ? "clínica escondida" : "clínicas escondidas"}{" "}
            por não ter movimento no período
          </span>
        )}
      </div>

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
  );
}

// --- Peças da tela ---------------------------------------------------------

const estiloCampo =
  "rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

function comPercentual(valor: number | null) {
  return valor === null ? "—" : `${valor}%`;
}

function Kpi({
  rotulo,
  valor,
  detalhe,
  alerta = false,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-black/45">
        {rotulo}
      </p>
      <p
        className={[
          "mt-3 text-3xl font-extrabold tracking-tight",
          alerta ? "text-herval-vermelho" : "text-herval-preto",
        ].join(" ")}
      >
        {valor}
      </p>
      {detalhe && (
        <p className="mt-3 text-xs font-medium text-black/50">{detalhe}</p>
      )}
    </div>
  );
}

function Tabela({
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

function Nome({ clinica, ativa }: { clinica: string; ativa: boolean }) {
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

function Num({
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
 */
type Coluna<T> =
  | { tipo: "soma"; valor: (linha: T) => number; moeda?: boolean }
  | { tipo: "taxa"; parte: (linha: T) => number; total: (linha: T) => number };

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

function Total<T>({ linhas, colunas }: { linhas: T[]; colunas: Coluna<T>[] }) {
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
            : coluna.moeda
              ? formatarMoeda(soma(coluna.valor))
              : formatarNumero(soma(coluna.valor))}
        </Num>
      ))}
    </tr>
  );
}

function razao(parte: number, total: number) {
  return total === 0 ? "—" : `${Math.round((parte / total) * 100)}%`;
}
