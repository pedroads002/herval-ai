"use client";

import { useState } from "react";
import { ArrowRight, CalendarPlus } from "lucide-react";
import type { Agendamento } from "@/data/agendamentos";
import type { Ligacao } from "@/data/ligacoes";
import { tentativasPorCanal } from "@/data/ligacoes";
import type { MudancaDeEtapa } from "@/data/historicoEtapas";
import {
  conveniosQueCobrem,
  procedimentoDaClinica,
  type Clinica,
} from "@/data/clinicas";
import { especialidadePorId, especialidadesIniciais } from "@/data/especialidades";
import { profissionaisDisponiveis } from "@/data/profissionais";
import { formatarDuracao, formatarMoeda } from "@/lib/formato";
import { duracao, tempoRelativo } from "@/lib/tempo";
import type { DadosDaConsulta } from "@/components/ProvedorLeads";

export const abasDoAtendimento = ["Agenda", "Ligações", "Clínica", "Log"] as const;
export type AbaDoAtendimento = (typeof abasDoAtendimento)[number];

const rotulo = "text-[11px] font-bold uppercase tracking-wide text-black/45";
const campo =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25";

/** Um dia relativo vira texto sem virar data fixa: "em 3 dias", "há 2 dias". */
function quandoEmDias(dias: number) {
  if (dias === 0) return "hoje";
  return dias < 0 ? `em ${duracao(-dias * 1440)}` : `há ${duracao(dias * 1440)}`;
}

export function AbaAgenda({
  clinica,
  agendamentos,
  aberto,
  aoAlternar,
  aoAgendar,
}: {
  clinica: Clinica | undefined;
  agendamentos: Agendamento[];
  /** Controlado de fora: converter uma ligação já abre o formulário. */
  aberto: boolean;
  aoAlternar: (aberto: boolean) => void;
  aoAgendar: (dados: DadosDaConsulta) => void;
}) {

  return (
    <div className="space-y-4">
      {agendamentos.length === 0 ? (
        <p className="text-sm font-medium text-black/55">
          Este lead ainda não tem consulta marcada.
        </p>
      ) : (
        <ul className="space-y-3">
          {[...agendamentos]
            .sort((a, b) => a.criadoHaDias - b.criadoHaDias)
            .map((agendamento) => (
              <li
                key={agendamento.id}
                className="rounded-controle border border-black/10 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-herval-preto">
                    {especialidadePorId(agendamento.especialidadeId ?? 0)?.nome ??
                      "Especialidade não informada"}
                  </span>
                  <span className="rounded-full border border-black/20 px-2 py-0.5 text-[11px] font-bold text-black/60">
                    {agendamento.status}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-black/60">
                  Consulta {quandoEmDias(agendamento.consultaEmDias)}
                  {agendamento.hora ? ` · ${agendamento.hora}` : " · sem horário"}
                </p>
                {agendamento.observacao && (
                  <p className="mt-2 rounded bg-black/[0.04] px-2.5 py-1.5 text-xs text-black/70">
                    {agendamento.observacao}
                  </p>
                )}
              </li>
            ))}
        </ul>
      )}

      {aberto ? (
        <FormularioDeConsulta
          clinica={clinica}
          aoAgendar={(dados) => {
            aoAgendar(dados);
            aoAlternar(false);
          }}
          aoCancelar={() => aoAlternar(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => aoAlternar(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-herval-verde px-4 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
        >
          <CalendarPlus className="h-4 w-4" />
          Agendar consulta
        </button>
      )}
    </div>
  );
}

/**
 * Os campos são os mesmos que a Agenda já usava — o que muda é só de onde se
 * marca. Procedimento, especialista, dia e horário são obrigatórios; a
 * observação, não. O horário final não é campo: sai da duração da
 * especialidade, e dois campos que precisam concordar é como divergência
 * começa.
 */
function FormularioDeConsulta({
  clinica,
  aoAgendar,
  aoCancelar,
}: {
  clinica: Clinica | undefined;
  aoAgendar: (dados: DadosDaConsulta) => void;
  aoCancelar: () => void;
}) {
  const oferecidas = especialidadesIniciais.filter(
    (e) =>
      e.ativa &&
      clinica !== undefined &&
      procedimentoDaClinica(clinica, e.id) !== null,
  );

  const [especialidadeId, setEspecialidadeId] = useState(oferecidas[0]?.id ?? 0);
  const [profissionalId, setProfissionalId] = useState(0);
  const [dias, setDias] = useState(1);
  const [hora, setHora] = useState("09:00");
  const [observacao, setObservacao] = useState("");

  const equipe = profissionaisDisponiveis(clinica?.id ?? 0, especialidadeId);
  const profissionalValido = equipe.some((p) => p.id === profissionalId)
    ? profissionalId
    : (equipe[0]?.id ?? 0);

  const especialidade = especialidadePorId(especialidadeId);
  const podeMarcar = oferecidas.length > 0 && equipe.length > 0;

  if (!podeMarcar) {
    return (
      <p className="rounded-controle bg-black/[0.04] p-3 text-xs font-medium text-black/60">
        Esta clínica não tem procedimento ativo com profissional disponível.
        Ajuste a ficha dela antes de marcar.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-controle border border-black/10 bg-black/[0.02] p-3">
      <div>
        <label className={rotulo}>Procedimento</label>
        <select
          value={especialidadeId}
          onChange={(e) => setEspecialidadeId(Number(e.target.value))}
          className={`mt-1 ${campo}`}
        >
          {oferecidas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={rotulo}>Especialista</label>
        <select
          value={profissionalValido}
          onChange={(e) => setProfissionalId(Number(e.target.value))}
          className={`mt-1 ${campo}`}
        >
          {equipe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={rotulo}>Data</label>
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className={`mt-1 ${campo}`}
          >
            {Array.from({ length: 15 }, (_, i) => i).map((d) => (
              <option key={d} value={d}>
                {d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo}>Horário</label>
          <select
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className={`mt-1 ${campo}`}
          >
            {Array.from({ length: 11 }, (_, i) => 8 + i).map((h) => (
              <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      {especialidade && (
        <p className="text-[11px] font-medium text-black/50">
          A consulta leva {formatarDuracao(especialidade.duracaoMinutos)} — o
          horário de término sai daí, não é digitado.
        </p>
      )}

      <div>
        <label className={rotulo}>Observações (opcional)</label>
        <textarea
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="O que a clínica precisa saber antes da consulta"
          className={`mt-1 ${campo}`}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            aoAgendar({
              especialidadeId,
              profissionalId: profissionalValido,
              consultaEmDias: -dias,
              hora,
              ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
            })
          }
          className="flex-1 rounded-full bg-herval-verde px-4 py-2 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold text-black/60 transition-colors hover:text-herval-preto"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function AbaLigacoes({ ligacoes }: { ligacoes: Ligacao[] }) {
  if (ligacoes.length === 0) {
    return (
      <p className="text-sm font-medium text-black/55">
        Ninguém ligou para este lead ainda.
      </p>
    );
  }

  const porCanal = tentativasPorCanal(ligacoes, ligacoes[0].leadId);

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-black/60">
        <span className="font-extrabold text-herval-preto">
          {ligacoes.length}
        </span>{" "}
        {ligacoes.length === 1 ? "tentativa" : "tentativas"} ·{" "}
        {porCanal.discador} no discador, {porCanal.whatsapp} por WhatsApp.
      </p>

      <ol className="space-y-2">
        {ligacoes.map((ligacao) => {
          const atendida = ligacao.desfecho === "atendida";
          return (
            <li
              key={ligacao.id}
              className="flex items-center justify-between gap-3 rounded-controle border border-black/10 px-3 py-2"
            >
              <div>
                <span className="text-sm font-bold text-herval-preto">
                  {ligacao.tentativa}ª ·{" "}
                  {ligacao.canal === "discador" ? "Discador" : "WhatsApp"}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-black/50">
                  {tempoRelativo(ligacao.minutosAtras)}
                </span>
              </div>
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[11px] font-bold",
                  atendida
                    ? "bg-herval-verde text-herval-preto"
                    : "border border-black/20 text-black/55",
                ].join(" ")}
              >
                {ligacao.desfecho}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AbaClinica({ clinica }: { clinica: Clinica | undefined }) {
  if (!clinica) {
    return (
      <p className="text-sm font-medium text-black/55">
        A clínica deste lead não está mais no cadastro.
      </p>
    );
  }

  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className={rotulo}>{clinica.nome}</p>
        <p className="mt-1 text-xs font-medium text-black/60">
          {clinica.cidade} ·{" "}
          {clinica.unidades === 0
            ? "sem unidade própria"
            : clinica.unidades === 1
              ? "1 unidade"
              : `${clinica.unidades} unidades`}
        </p>
        <p className="mt-1 text-xs text-black/60">{clinica.endereco}</p>
        <p className="text-xs text-black/60">{clinica.horarioFuncionamento}</p>
      </div>

      <Bloco titulo="Estratégia e diferenciais">
        <p className="text-xs leading-relaxed text-black/70">{clinica.historia}</p>
        <p className="mt-2 text-xs leading-relaxed text-black/70">
          {clinica.diferenciais}
        </p>
      </Bloco>

      <Bloco titulo="Comercial e condições">
        <p className="text-xs text-black/70">
          Ticket médio{" "}
          <span className="font-bold text-herval-preto">
            {clinica.ticketMedio === null
              ? "ainda sem histórico"
              : formatarMoeda(clinica.ticketMedio)}
          </span>{" "}
          · em até {clinica.parcelasMaximas}x
        </p>
        <p className="mt-1 text-xs text-black/70">
          {clinica.formasPagamento.join(", ")}
        </p>
        <p className="mt-2 text-xs text-black/70">
          {clinica.convenios.length === 0
            ? "Sem convênio: a clínica não aceita nenhum."
            : clinica.convenios
                .map(
                  (c) =>
                    `${c.nome} (${
                      c.especialidadeIds.length === 0
                        ? "nada coberto"
                        : c.especialidadeIds
                            .map((id) => especialidadePorId(id)?.nome)
                            .join(", ")
                    })`,
                )
                .join(" · ")}
        </p>
      </Bloco>

      <Bloco titulo="Público-alvo">
        <p className="text-xs text-black/70">
          Classe {clinica.classes.join("/")} · de {clinica.faixaEtaria.de} a{" "}
          {clinica.faixaEtaria.ate} anos
        </p>
        <ul className="mt-1.5 space-y-1">
          {clinica.principaisDores.map((dor) => (
            <li key={dor} className="text-xs text-black/70">
              · {dor}
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Valores por procedimento">
        <ul className="space-y-1.5">
          {clinica.procedimentos.map((procedimento) => {
            const foco = procedimento.especialidadeId === clinica.tratamentoFocoId;
            const cobertura = conveniosQueCobrem(
              clinica,
              procedimento.especialidadeId,
            );
            return (
              <li key={procedimento.especialidadeId} className="text-xs text-black/70">
                <span className="font-bold text-herval-preto">
                  {especialidadePorId(procedimento.especialidadeId)?.nome}
                </span>
                {foco && (
                  <span className="ml-1.5 rounded-full bg-herval-verde/15 px-2 py-0.5 text-[10px] font-bold text-herval-preto">
                    carro-chefe
                  </span>
                )}
                {" · "}
                {procedimento.valorConsulta === null
                  ? "avaliação gratuita"
                  : `avaliação ${formatarMoeda(procedimento.valorConsulta)}`}
                {cobertura.length > 0 && ` · coberto por ${cobertura.map((c) => c.nome).join(", ")}`}
              </li>
            );
          })}
        </ul>
      </Bloco>
    </div>
  );
}

export function AbaLog({ mudancas }: { mudancas: MudancaDeEtapa[] }) {
  if (mudancas.length === 0) {
    return (
      <p className="text-sm font-medium text-black/55">
        Sem movimentação registrada para este lead.
      </p>
    );
  }

  return (
    <ol className="space-y-3 border-l-2 border-black/10 pl-4">
      {mudancas.map((mudanca) => (
        <li key={mudanca.id}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-herval-preto">
              {tempoRelativo(mudanca.minutosAtras)}
            </span>
            <span className="rounded-full border border-black/20 px-2 py-0.5 text-[10px] font-bold text-black/55">
              {mudanca.agente.nome ?? mudanca.agente.tipo}
            </span>
          </div>
          <p className="mt-1 text-xs text-black/70">
            {mudanca.etapaAnterior === null ? (
              <>Entrou na base em {mudanca.etapaNova}</>
            ) : (
              <>
                {mudanca.etapaAnterior}{" "}
                <ArrowRight className="inline h-3 w-3 text-black/35" />{" "}
                <span className="font-bold text-herval-preto">
                  {mudanca.etapaNova}
                </span>
              </>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={rotulo}>{titulo}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
