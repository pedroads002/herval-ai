"use client";

import { Fragment, useMemo, useState } from "react";
import { nomeDaClinica } from "@/data/clinicas";
import {
  Check,
  X,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  PhoneCall,
  AlertTriangle,
  Clock,
} from "lucide-react";
import Etiqueta, { type TomEtiqueta } from "@/components/Etiqueta";
import EtiquetaResponsavel from "@/components/EtiquetaResponsavel";
import { descricaoPrazo, grupoDoPrazo, gruposPrazo } from "@/lib/prazo";
import { tempoRelativo } from "@/lib/tempo";
import CartaoIndicador from "@/components/CartaoIndicador";
import { calcularIndicadoresFila } from "@/data/indicadores";
import { useLeads } from "@/components/ProvedorLeads";
import {
  situacaoDaEtapa,
  situacoesAtivas,
  type NivelScore,
  type StatusTarefa,
} from "@/data/tarefas";

const filtros = [
  "Ativos",
  "Todos",
  "Pendentes",
  "Em Atendimento",
  "Aguardando Resposta",
  "Agendados",
  "Ganhos",
  "Desqualificados",
] as const;

type Filtro = (typeof filtros)[number];

const tomDoStatus: Record<StatusTarefa, TomEtiqueta> = {
  Pendente: "contorno",
  Aprovado: "verde",
  Rejeitado: "preto",
  Avisado: "verde",
};

/** O verde marca a chance alta; os demais níveis usam contorno preto. */
function estiloScore(nivel: NivelScore) {
  return nivel === "Alta"
    ? "bg-herval-verde text-herval-preto"
    : "border border-black/20 text-black/70";
}

export default function TabelaTarefas() {
  // A base é a mesma do Funil: mover um card lá muda esta tabela na hora.
  const { tarefas, definirStatus } = useLeads();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Ativos");
  const [expandida, setExpandida] = useState<number | null>(null);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return tarefas.filter((t) => {
      const situacao = situacaoDaEtapa(t.etapa);
      const combinaBusca =
        termo === "" ||
        t.lead.toLowerCase().includes(termo) ||
        t.telefone.toLowerCase().includes(termo) ||
        nomeDaClinica(t.clinicaId).toLowerCase().includes(termo);

      const combinaFiltro =
        filtro === "Todos"
          ? true
          : filtro === "Ativos"
            ? situacoesAtivas.includes(situacao)
            : filtro === "Pendentes"
              ? situacao === "Pendente"
              : filtro === "Agendados"
                ? situacao === "Agendado"
                : filtro === "Ganhos"
                  ? situacao === "Ganho"
                  : filtro === "Desqualificados"
                    ? situacao === "Desqualificado"
                    : situacao === filtro;

      return combinaBusca && combinaFiltro;
    });
  }, [tarefas, busca, filtro]);

  // Agrupa por urgência, mantendo a ordem: atrasadas primeiro.
  const agrupadas = useMemo(
    () =>
      gruposPrazo
        .map((grupo) => ({
          grupo,
          itens: visiveis.filter((t) => grupoDoPrazo(t.prazoEmHoras) === grupo),
        }))
        .filter((secao) => secao.itens.length > 0),
    [visiveis],
  );

  // Os cards saem das mesmas tarefas da tabela, então nunca divergem dela.
  const indicadores = useMemo(() => calcularIndicadoresFila(tarefas), [tarefas]);

  // Mesma contagem do card "Pendentes": leads aguardando a primeira ação.
  const pendentes = tarefas.filter(
    (t) => situacaoDaEtapa(t.etapa) === "Pendente",
  ).length;
  // Métrica diferente e com nome próprio: tarefas sem decisão tomada.
  const aguardandoDecisao = tarefas.filter(
    (t) => t.status === "Pendente",
  ).length;
  const atrasadas = visiveis.filter(
    (t) => grupoDoPrazo(t.prazoEmHoras) === "Atrasada",
  ).length;

  return (
    <div className="space-y-8">
      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((indicador) => (
          <CartaoIndicador key={indicador.id} {...indicador} />
        ))}
      </div>

      {/* Busca e filtro */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou clínica"
            className="w-full rounded-full border border-black/15 bg-herval-branco py-3 pl-11 pr-4 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
          />
        </div>

        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Filtro)}
          className="rounded-full border border-black/15 bg-herval-branco px-5 py-3 text-sm font-bold text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
        >
          {filtros.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">
          {visiveis.length}
        </span>{" "}
        {visiveis.length === 1 ? "tarefa exibida" : "tarefas exibidas"} ·{" "}
        <span className="font-extrabold text-herval-preto">{pendentes}</span>{" "}
        {pendentes === 1 ? "pendente" : "pendentes"} na fila ·{" "}
        <span className="font-extrabold text-herval-preto">
          {aguardandoDecisao}
        </span>{" "}
        aguardando decisão
        {atrasadas > 0 && (
          <>
            {" · "}
            <span className="font-extrabold text-herval-preto">
              {atrasadas}
            </span>{" "}
            {atrasadas === 1 ? "atrasada" : "atrasadas"}
          </>
        )}
        .
      </p>

      {/* Tabela */}
      <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-black/10 bg-black/[0.03] text-left text-xs uppercase tracking-wider text-black/50">
              <tr>
                <th className="px-6 py-4 font-bold">Lead</th>
                <th className="px-6 py-4 font-bold">Regra disparada</th>
                <th className="px-6 py-4 font-bold">Ação sugerida</th>
                <th className="px-6 py-4 font-bold">Responsável</th>
                <th className="px-6 py-4 font-bold">Score</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.07]">
              {visiveis.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-14 text-center font-medium text-black/50"
                  >
                    Nenhuma tarefa encontrada com esses filtros.
                  </td>
                </tr>
              )}

              {agrupadas.map((secao) => (
                <Fragment key={secao.grupo}>
                  <tr>
                    <td colSpan={7} className="bg-black/[0.04] px-6 py-3">
                      <span
                        className={[
                          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold",
                          secao.grupo === "Atrasada"
                            ? "bg-herval-preto text-herval-branco"
                            : "border border-black/20 text-black/70",
                        ].join(" ")}
                      >
                        {secao.grupo === "Atrasada" && (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {secao.grupo}
                        <span className="font-bold opacity-70">
                          {secao.itens.length}
                        </span>
                      </span>
                    </td>
                  </tr>

                  {secao.itens.map((tarefa) => {
                const alerta = tarefa.tipo === "alerta-humano";
                const aberta = expandida === tarefa.id;

                return (
                  <Fragment key={tarefa.id}>
                    <tr
                      className={
                        alerta
                          ? "bg-herval-verde/[0.07]"
                          : "transition-colors hover:bg-herval-verde/[0.06]"
                      }
                    >
                      <td className="px-6 py-5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandida(aberta ? null : tarefa.id)
                          }
                          aria-expanded={aberta}
                          className="flex items-start gap-2 text-left"
                        >
                          {aberta ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-black/50" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-black/50" />
                          )}
                          <span>
                            <span className="block font-bold text-herval-preto">
                              {tarefa.lead}
                            </span>
                            <span className="mt-0.5 block text-xs font-medium text-black/45">
                              {tarefa.telefone} · {nomeDaClinica(tarefa.clinicaId)}
                            </span>
                          </span>
                        </button>
                      </td>

                      <td className="px-6 py-5">
                        <span className="block text-black/65">
                          {tarefa.regra}
                        </span>
                        <span
                          className={[
                            "mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold",
                            tarefa.prazoEmHoras < 0
                              ? "text-herval-preto"
                              : "text-black/45",
                          ].join(" ")}
                        >
                          <Clock className="h-3 w-3" />
                          {descricaoPrazo(tarefa.prazoEmHoras)}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        {alerta ? (
                          <span className="inline-flex items-start gap-2 font-bold text-herval-preto">
                            <Bell className="mt-0.5 h-4 w-4 shrink-0" />
                            {tarefa.acao}
                          </span>
                        ) : (
                          <span className="text-black/65">{tarefa.acao}</span>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <EtiquetaResponsavel
                          responsavel={tarefa.responsavel}
                          destacado={alerta}
                        />
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${estiloScore(
                            tarefa.score.nivel,
                          )}`}
                        >
                          {tarefa.score.percentual}% para agendar ·{" "}
                          {tarefa.score.nivel}
                        </span>
                        <span className="mt-1.5 block text-xs font-medium text-black/45">
                          {tarefa.score.motivo}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <Etiqueta
                          texto={tarefa.status}
                          tom={tomDoStatus[tarefa.status]}
                        />
                      </td>

                      <td className="px-6 py-5">
                        {alerta ? (
                          // Alerta humano: não há o que aprovar, só registrar
                          // que o CRC foi avisado.
                          <button
                            type="button"
                            onClick={() =>
                              definirStatus(
                                tarefa.id,
                                tarefa.status === "Avisado"
                                  ? "Pendente"
                                  : "Avisado",
                              )
                            }
                            className={[
                              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
                              tarefa.status === "Avisado"
                                ? "bg-herval-verde text-herval-preto hover:bg-herval-verdeEscuro"
                                : "bg-herval-preto text-herval-branco hover:bg-black/85",
                            ].join(" ")}
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                            {tarefa.status === "Avisado"
                              ? "CRC avisado"
                              : "Avisar CRC"}
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              aria-pressed={tarefa.status === "Aprovado"}
                              onClick={() =>
                                definirStatus(tarefa.id, "Aprovado")
                              }
                              className={[
                                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
                                tarefa.status === "Aprovado"
                                  ? "bg-herval-verde text-herval-preto hover:bg-herval-verdeEscuro"
                                  : "border border-black/15 text-black/70 hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto",
                              ].join(" ")}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Aprovar
                            </button>
                            <button
                              type="button"
                              aria-pressed={tarefa.status === "Rejeitado"}
                              onClick={() =>
                                definirStatus(tarefa.id, "Rejeitado")
                              }
                              className={[
                                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
                                tarefa.status === "Rejeitado"
                                  ? "bg-herval-preto text-herval-branco hover:bg-black/85"
                                  : "border border-black/15 text-black/70 hover:border-herval-preto hover:bg-black/5 hover:text-herval-preto",
                              ].join(" ")}
                            >
                              <X className="h-3.5 w-3.5" />
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Histórico do lead */}
                    {aberta && (
                      <tr className="bg-black/[0.02]">
                        <td colSpan={7} className="px-6 py-6">
                          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-black/50">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Histórico da IA com {tarefa.lead}
                          </h3>

                          {tarefa.historico.length === 0 ? (
                            <p className="mt-4 text-sm font-medium text-black/55">
                              A IA ainda não enviou nenhuma mensagem para este
                              lead. O primeiro contato é feito pelo CRC.
                            </p>
                          ) : (
                            <ol className="mt-4 space-y-4 border-l-2 border-herval-verde pl-5">
                              {tarefa.historico.map((evento, indice) => (
                                <li key={indice}>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-extrabold text-herval-preto">
                                      {tempoRelativo(evento.minutosAtras)}
                                    </span>
                                    <span className="rounded-full border border-black/20 px-2.5 py-0.5 text-[11px] font-bold text-black/60">
                                      {evento.regra}
                                    </span>
                                  </div>
                                  <p className="mt-1.5 max-w-3xl text-sm text-black/70">
                                    {evento.mensagem}
                                  </p>
                                </li>
                              ))}
                            </ol>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
