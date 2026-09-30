"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
  X,
} from "lucide-react";
import {
  dataCompleta,
  dataDoDia,
  diaEMes,
  horaDentroDoHorario,
  horariosGrade,
  inicioDaSemana,
  inicioDoDia,
  intervaloDaSemana,
  mesmaData,
  nomesCurtosDosDias,
  rotuloDaConsulta,
  somarDias,
  textoDoDia,
  type RotuloDaConsulta,
} from "@/data/agenda";
import type { Consulta, DadosDaAgenda, LeadDaAgenda } from "@/lib/dados/agenda";
import type {
  ClienteDoCadastro,
  EspecialidadeDoCadastro,
  HorarioNaUnidade,
  ProfissionalCadastrado,
  UnidadeDoCadastro,
} from "@/lib/dados/profissionais";
import { definirDesfechoDaConsulta, marcarConsulta } from "@/lib/acoes/agenda";
import {
  Aviso,
  botaoPrincipal,
  campoBase,
  rotulo as estiloRotulo,
  useQuandoDerCerto,
} from "@/components/cadastro/comuns";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";
import { formatarDuracao } from "@/lib/formato";

type Modo = "Dia" | "Semana";

/** Consulta pronta para a grade: o lead junto da consulta dele. */
type ItemAgenda = {
  consulta: Consulta;
  lead: LeadDaAgenda;
  data: Date;
  rotulo: RotuloDaConsulta;
};

const estiloRotuloDaConsulta: Record<RotuloDaConsulta, string> = {
  Agendado: "border border-black/25 text-black/70",
  Confirmado: "bg-herval-verde text-herval-preto",
  Compareceu: "bg-herval-preto text-herval-branco",
  Faltou: "bg-herval-vermelho text-herval-branco",
  Cancelada: "border border-black/25 text-black/40 line-through",
};

type Props = Omit<DadosDaAgenda, "aviso">;

export default function PainelAgenda({
  consultas,
  leads,
  pessoas,
  clientes,
  procedimentos,
  falha,
}: Props) {
  // A data só é lida depois que a tela monta, para o servidor e o navegador
  // nunca renderizarem dias diferentes.
  const [hoje, setHoje] = useState<Date | null>(null);
  const [referencia, setReferencia] = useState<Date | null>(null);

  useEffect(() => {
    const agora = inicioDoDia(new Date());
    setHoje(agora);
    setReferencia(agora);
  }, []);

  const [modo, setModo] = useState<Modo>("Semana");
  const [filtroUnidade, setFiltroUnidade] = useState<"todas" | number>("todas");
  const [filtroPessoa, setFiltroPessoa] = useState<"todos" | number>("todos");
  const [formAberto, setFormAberto] = useState(false);
  const [avisoSincronizar, setAvisoSincronizar] = useState(false);

  const unidades = useMemo(() => unidadesDosClientes(clientes), [clientes]);
  const unidadePorId = useMemo(
    () => new Map(unidades.map((u) => [u.id, u])),
    [unidades],
  );
  const leadPorId = useMemo(
    () => new Map(leads.map((l) => [l.id, l])),
    [leads],
  );
  const pessoaPorId = useMemo(
    () => new Map(pessoas.map((p) => [p.id, p])),
    [pessoas],
  );
  const procedimentoPorId = useMemo(
    () => new Map(procedimentos.map((p) => [p.id, p])),
    [procedimentos],
  );

  /** Só gente ativa pode receber consulta nova. */
  const equipeAtiva = useMemo(() => pessoas.filter((p) => p.ativo), [pessoas]);

  /** As unidades que a grade está olhando agora. */
  const unidadesVisiveis = useMemo(
    () =>
      filtroUnidade === "todas"
        ? unidades.map((u) => u.id)
        : [filtroUnidade as number],
    [filtroUnidade, unidades],
  );

  /** Quem atende em alguma das unidades visíveis. */
  const pessoasVisiveis = useMemo(() => {
    const naUnidade = equipeAtiva.filter((p) =>
      p.unidades.some((u) => unidadesVisiveis.includes(u.id)),
    );
    return filtroPessoa === "todos"
      ? naUnidade
      : naUnidade.filter((p) => p.id === filtroPessoa);
  }, [equipeAtiva, unidadesVisiveis, filtroPessoa]);

  const itens = useMemo<ItemAgenda[]>(
    () =>
      consultas
        .filter((c) => c.status !== "Cancelada" && c.hora !== null)
        .filter((c) => unidadesVisiveis.includes(c.unidadeId))
        .filter(
          (c) => filtroPessoa === "todos" || c.profissionalId === filtroPessoa,
        )
        .map((consulta) => {
          const lead = leadPorId.get(consulta.leadId);
          if (!lead) return null;
          return {
            consulta,
            lead,
            data: dataDoDia(consulta.dia),
            rotulo: rotuloDaConsulta(consulta),
          };
        })
        .filter((item): item is ItemAgenda => item !== null),
    [consultas, unidadesVisiveis, filtroPessoa, leadPorId],
  );

  /**
   * Quem está sem data marcada. Inclui quem faltou: a consulta dele existe, mas
   * está encerrada, então ele precisa de horário novo. Quem já compareceu não
   * entra — a consulta dele acabou.
   */
  const semHorario = useMemo(() => {
    const comConsultaAberta = new Set(
      consultas.filter((c) => c.status === "Agendada").map((c) => c.leadId),
    );
    return leads.filter(
      (lead) =>
        lead.etapa !== "Comparecimento" && !comConsultaAberta.has(lead.id),
    );
  }, [leads, consultas]);

  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  if (!hoje || !referencia) {
    return (
      <p className="text-sm font-medium text-black/45">
        Carregando a agenda...
      </p>
    );
  }

  const domingo = inicioDaSemana(referencia);
  const diasVisiveis =
    modo === "Semana"
      ? Array.from({ length: 7 }, (_, i) => somarDias(domingo, i))
      : [referencia];

  const itensVisiveis = itens.filter((item) =>
    diasVisiveis.some((dia) => mesmaData(dia, item.data)),
  );

  const horasDaGrade = linhasDaGrade(itensVisiveis);

  function navegar(passo: number) {
    setReferencia((atual) =>
      atual ? somarDias(atual, modo === "Semana" ? passo * 7 : passo) : atual,
    );
  }

  return (
    <div className="space-y-7">
      {/* Barra de controles */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-black/15 bg-herval-branco p-1">
            {(["Dia", "Semana"] as Modo[]).map((opcao) => {
              const ativo = opcao === modo;
              return (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setModo(opcao)}
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

          <div className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-herval-branco p-1">
            <button
              type="button"
              onClick={() => navegar(-1)}
              aria-label={
                modo === "Semana" ? "Semana anterior" : "Dia anterior"
              }
              className="rounded-full p-2 text-black/60 transition-colors hover:bg-black/5 hover:text-herval-preto"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setReferencia(hoje)}
              className="rounded-full px-3 py-1.5 text-sm font-bold text-black/70 transition-colors hover:bg-black/5 hover:text-herval-preto"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => navegar(1)}
              aria-label={modo === "Semana" ? "Próxima semana" : "Próximo dia"}
              className="rounded-full p-2 text-black/60 transition-colors hover:bg-black/5 hover:text-herval-preto"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <label className="inline-flex items-center gap-2">
            <span className="sr-only">Unidade</span>
            <select
              value={filtroUnidade}
              onChange={(e) => {
                setFiltroUnidade(
                  e.target.value === "todas" ? "todas" : Number(e.target.value),
                );
                // Trocar de unidade pode deixar de fora a pessoa filtrada, e a
                // grade ficaria vazia sem explicação nenhuma na tela.
                setFiltroPessoa("todos");
              }}
              className={estiloFiltro}
            >
              <option value="todas">Todas as unidades</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.clienteNome} · {u.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2">
            <span className="sr-only">Profissional</span>
            <select
              value={filtroPessoa}
              onChange={(e) =>
                setFiltroPessoa(
                  e.target.value === "todos" ? "todos" : Number(e.target.value),
                )
              }
              className={estiloFiltro}
            >
              <option value="todos">Todos os profissionais</option>
              {equipeAtiva
                .filter((p) =>
                  p.unidades.some((u) => unidadesVisiveis.includes(u.id)),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setAvisoSincronizar((v) => !v)}
            aria-expanded={avisoSincronizar}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-herval-branco px-4 py-2.5 text-sm font-bold text-black/65 transition-colors hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar Agenda
          </button>

          <button
            type="button"
            onClick={() => setFormAberto((v) => !v)}
            aria-expanded={formAberto}
            className="inline-flex items-center gap-2 rounded-full bg-herval-verde px-5 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
          >
            <CalendarPlus className="h-4 w-4" />
            Nova Consulta
          </button>
        </div>
      </div>

      {avisoSincronizar && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-card border border-black/10 bg-herval-branco p-5 shadow-card"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-black/45" />
          <div className="text-sm font-medium text-black/65">
            <p className="font-bold text-herval-preto">
              Nada foi sincronizado com sistema de fora.
            </p>
            <p className="mt-1.5">
              As consultas desta tela são as que a equipe e a Helô marcam aqui,
              e ficam gravadas. A sincronização com Clinicorp, Simples Dental ou
              Dental Office fica disponível quando a integração for conectada na
              tela de Integrações.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAvisoSincronizar(false)}
            aria-label="Fechar aviso"
            className="ml-auto shrink-0 rounded-full p-1 text-black/40 transition-colors hover:bg-black/5 hover:text-herval-preto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {formAberto && (
        <FormularioNovaConsulta
          candidatos={semHorario}
          clientes={clientes}
          unidades={unidades}
          equipe={equipeAtiva}
          procedimentos={procedimentos}
          diaSugerido={textoDoDia(referencia)}
          aoMarcar={() => setFormAberto(false)}
          aoFechar={() => setFormAberto(false)}
        />
      )}

      {/* Título do período e resumo */}
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-herval-preto">
          {modo === "Semana"
            ? intervaloDaSemana(domingo)
            : dataCompleta(referencia)}
        </h2>
        <p className="mt-1 text-sm font-medium text-black/55">
          <span className="font-extrabold text-herval-preto">
            {itensVisiveis.length}
          </span>{" "}
          {itensVisiveis.length === 1 ? "consulta" : "consultas"} no período ·{" "}
          {leads.length} leads em Agendamento, Reagendamento ou Comparecimento
          no Funil
          {semHorario.length > 0 && ` · ${semHorario.length} sem horário`}
        </p>
      </div>

      {semHorario.length > 0 && (
        <section className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
          <h3 className="text-sm font-extrabold tracking-tight text-herval-preto">
            Aguardando horário
          </h3>
          <p className="mt-1 text-xs font-medium text-black/50">
            Estão em etapa de agenda no Funil e não têm consulta marcada em
            aberto — inclui quem faltou e precisa remarcar. Use &quot;Nova
            Consulta&quot; para dar uma data.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {semHorario.map((lead) => (
              <li
                key={lead.id}
                className="rounded-controle border border-black/10 bg-black/[0.03] px-3.5 py-2.5"
              >
                <p className="text-sm font-bold text-herval-preto">
                  {lead.nome}
                </p>
                <p className="text-xs font-medium text-black/45">
                  {[lead.telefone, lead.etapa].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modo === "Semana" ? (
        <GradeSemana
          dias={diasVisiveis}
          horas={horasDaGrade}
          hoje={hoje}
          itens={itens}
          pessoaPorId={pessoaPorId}
          unidadePorId={unidadePorId}
          procedimentoPorId={procedimentoPorId}
        />
      ) : (
        <GradeDia
          dia={referencia}
          horas={horasDaGrade}
          itens={itens}
          pessoas={pessoasVisiveis}
          unidadesVisiveis={unidadesVisiveis}
          pessoaPorId={pessoaPorId}
          unidadePorId={unidadePorId}
          procedimentoPorId={procedimentoPorId}
        />
      )}
    </div>
  );
}

const estiloFiltro =
  "rounded-full border border-black/15 bg-herval-branco px-4 py-2.5 text-sm font-bold text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

/**
 * Todas as unidades, de todos os clientes. Cada uma já sabe de quem é — o nome
 * do cliente vem junto da leitura do cadastro.
 */
function unidadesDosClientes(clientes: ClienteDoCadastro[]) {
  return clientes.flatMap((cliente) => cliente.unidades);
}

/**
 * As linhas de hora que a grade desenha.
 *
 * Começa na faixa de funcionamento e cresce para caber consulta fora dela: a
 * Helô pode marcar 19:30 se a clínica combinar assim, e uma linha que não existe
 * na grade seria uma consulta invisível na tela.
 */
function linhasDaGrade(itens: ItemAgenda[]) {
  const horas = new Set(horariosGrade);
  for (const item of itens) {
    if (item.consulta.hora) horas.add(`${item.consulta.hora.slice(0, 2)}:00`);
  }
  return [...horas].sort();
}

/**
 * A consulta cai nesta linha da grade.
 *
 * Compara só a hora cheia porque a linha é de uma hora e a consulta pode estar
 * em qualquer minuto: quem marca 09:30 aparece na faixa das 9, com o horário
 * exato escrito no cartão.
 */
function naLinha(consulta: Consulta, hora: string) {
  return (consulta.hora ?? "").slice(0, 2) === hora.slice(0, 2);
}

/**
 * Verdadeiro quando a pessoa atende naquele dia e naquela hora, em alguma das
 * unidades que a grade está olhando.
 *
 * Sem horário cadastrado devolve verdadeiro: quem não informou não tem hora
 * proibida. É o que faz a grade escurecer apenas o que a agência de fato
 * cadastrou, em vez de escurecer tudo de quem ainda não preencheu.
 */
function atendeNaHora(
  pessoa: ProfissionalCadastrado,
  dia: Date,
  hora: string,
  unidadesVisiveis: number[],
) {
  const horarios = pessoa.horarios.filter((h) =>
    unidadesVisiveis.includes(h.unidadeId),
  );
  if (horarios.length === 0) return true;

  return horarios.some((horario) => atendeNesteHorario(horario, dia, hora));
}

/** 1 é segunda e 7 é domingo, como o cadastro guarda. */
function diaDaSemanaDoCadastro(dia: Date) {
  const doJavascript = dia.getDay();
  return doJavascript === 0 ? 7 : doJavascript;
}

function atendeNesteHorario(
  horario: HorarioNaUnidade,
  dia: Date,
  hora: string,
) {
  const noDia =
    horario.dias.length === 0 ||
    horario.dias.includes(diaDaSemanaDoCadastro(dia));
  return noDia && horaDentroDoHorario(hora, horario.inicio, horario.fim);
}

type Buscadores = {
  pessoaPorId: Map<number, ProfissionalCadastrado>;
  unidadePorId: Map<number, UnidadeDoCadastro>;
  procedimentoPorId: Map<number, EspecialidadeDoCadastro>;
};

/** Grade semanal: linhas de hora, colunas de dia. */
function GradeSemana({
  dias,
  horas,
  hoje,
  itens,
  ...buscadores
}: {
  dias: Date[];
  horas: string[];
  hoje: Date;
  itens: ItemAgenda[];
} & Buscadores) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2 md:-mx-10 md:px-10">
      <div className="min-w-[64rem] overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        {/* Cabeçalho dos dias */}
        <div className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] border-b border-black/10 bg-black/[0.03]">
          <div className="px-3 py-3" />
          {dias.map((dia) => {
            const ehHoje = mesmaData(dia, hoje);
            return (
              <div
                key={dia.toISOString()}
                className={[
                  "border-l border-black/10 px-3 py-3 text-center",
                  ehHoje ? "bg-herval-verde/20" : "",
                ].join(" ")}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-black/45">
                  {nomesCurtosDosDias[dia.getDay()]}
                </p>
                <p className="mt-0.5 text-sm font-extrabold text-herval-preto">
                  {diaEMes(dia)}
                </p>
              </div>
            );
          })}
        </div>

        {horas.map((hora) => (
          <div
            key={hora}
            className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] border-b border-black/[0.07] last:border-b-0"
          >
            <div className="px-3 py-3 text-xs font-bold tabular-nums text-black/40">
              {hora}
            </div>

            {dias.map((dia) => {
              const doDia = itens.filter(
                (item) =>
                  mesmaData(item.data, dia) && naLinha(item.consulta, hora),
              );

              return (
                <div
                  key={dia.toISOString()}
                  className="min-h-[3.5rem] space-y-1.5 border-l border-black/10 p-1.5"
                >
                  {doDia.map((item) => (
                    <CartaoConsulta
                      key={item.consulta.id}
                      item={item}
                      compacto
                      {...buscadores}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grade do dia: linhas de hora, colunas de profissional. */
function GradeDia({
  dia,
  horas,
  itens,
  pessoas,
  unidadesVisiveis,
  ...buscadores
}: {
  dia: Date;
  horas: string[];
  itens: ItemAgenda[];
  pessoas: ProfissionalCadastrado[];
  unidadesVisiveis: number[];
} & Buscadores) {
  const doDia = itens.filter((item) => mesmaData(item.data, dia));

  /**
   * Consulta sem profissional definido não cabe em coluna de ninguém, e some da
   * vista do dia se a gente não contar. A coluna "A definir" só aparece quando
   * existe alguma.
   */
  const semPessoa = doDia.filter(
    (item) => item.consulta.profissionalId === null,
  );
  const colunas: (ProfissionalCadastrado | null)[] = [
    ...pessoas,
    ...(semPessoa.length > 0 ? [null] : []),
  ];

  if (colunas.length === 0) {
    return (
      <p className="rounded-card border border-black/10 bg-herval-branco px-5 py-6 text-sm font-medium text-black/55 shadow-card">
        Nenhum profissional ativo atende nas unidades filtradas. Cadastre quem
        atende em Clientes, ou troque o filtro de unidade.
      </p>
    );
  }

  const gradeDeColunas = `5rem repeat(${colunas.length}, minmax(0,1fr))`;

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2 md:-mx-10 md:px-10">
      <div className="min-w-[64rem] overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        <div
          className="grid border-b border-black/10 bg-black/[0.03]"
          style={{ gridTemplateColumns: gradeDeColunas }}
        >
          <div className="px-3 py-3" />
          {colunas.map((pessoa) => (
            <div
              key={pessoa?.id ?? "a-definir"}
              className="border-l border-black/10 px-3 py-3"
            >
              <p className="text-sm font-extrabold text-herval-preto">
                {pessoa ? pessoa.nome : "A definir"}
              </p>
              <p className="text-xs font-medium text-black/45">
                {pessoa ? pessoa.tipo : "Consultas sem profissional"}
              </p>
            </div>
          ))}
        </div>

        {horas.map((hora) => (
          <div
            key={hora}
            className="grid border-b border-black/[0.07] last:border-b-0"
            style={{ gridTemplateColumns: gradeDeColunas }}
          >
            <div className="px-3 py-3 text-xs font-bold tabular-nums text-black/40">
              {hora}
            </div>

            {colunas.map((pessoa) => {
              const consultas = doDia.filter(
                (item) =>
                  (item.consulta.profissionalId ?? null) ===
                    (pessoa?.id ?? null) && naLinha(item.consulta, hora),
              );
              const foraDoHorario =
                pessoa !== null &&
                !atendeNaHora(pessoa, dia, hora, unidadesVisiveis)
                  ? pessoa
                  : null;

              return (
                <div
                  key={pessoa?.id ?? "a-definir"}
                  title={
                    foraDoHorario
                      ? `${foraDoHorario.nome} não atende neste horário`
                      : undefined
                  }
                  className={[
                    "min-h-[3.5rem] space-y-1.5 border-l border-black/10 p-1.5",
                    foraDoHorario ? "bg-black/[0.04]" : "",
                  ].join(" ")}
                >
                  {consultas.map((item) => (
                    <CartaoConsulta
                      key={item.consulta.id}
                      item={item}
                      {...buscadores}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CartaoConsulta({
  item,
  compacto = false,
  pessoaPorId,
  unidadePorId,
  procedimentoPorId,
}: {
  item: ItemAgenda;
  compacto?: boolean;
} & Buscadores) {
  const { consulta, lead } = item;
  const procedimento =
    consulta.especialidadeId === null
      ? undefined
      : procedimentoPorId.get(consulta.especialidadeId);
  const pessoa =
    consulta.profissionalId === null
      ? undefined
      : pessoaPorId.get(consulta.profissionalId);
  const unidade = unidadePorId.get(consulta.unidadeId);

  return (
    <article className="rounded-controle border border-black/10 bg-herval-branco p-2.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-extrabold tabular-nums text-herval-preto">
          {consulta.hora}
        </p>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-bold",
            estiloRotuloDaConsulta[item.rotulo],
          ].join(" ")}
        >
          {item.rotulo}
        </span>
      </div>

      <p className="mt-1 text-xs font-bold leading-tight text-herval-preto">
        {lead.nome}
      </p>

      {procedimento && (
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-black/50">
          {procedimento.nome} ·{" "}
          {formatarDuracao(procedimento.duracaoMinutos ?? 0)}
        </p>
      )}

      {compacto && pessoa && (
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-black/45">
          {primeiroNome(pessoa.nome)}
        </p>
      )}

      {!compacto && (
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-black/45">
          {[lead.telefone, unidade?.nome].filter(Boolean).join(" · ")}
        </p>
      )}

      {consulta.observacao && (
        <p className="mt-1 text-[11px] font-medium leading-snug text-black/55">
          {consulta.observacao}
        </p>
      )}

      {consulta.status === "Agendada" && <Desfecho consulta={consulta} />}
    </article>
  );
}

/**
 * Os dois botões de desfecho. Marcar move o lead de etapa sozinho: quem
 * comparece vai para "Comparecimento", quem falta cai em "Reagendamento".
 */
function Desfecho({ consulta }: { consulta: Consulta }) {
  const [estado, executar, enviando] = useActionState(
    definirDesfechoDaConsulta,
    RESULTADO_INICIAL,
  );

  return (
    <form action={executar} className="mt-2 border-t border-black/10 pt-2">
      <input type="hidden" name="id" value={consulta.id} />
      <div className="flex gap-1.5">
        <button
          type="submit"
          name="status"
          value="Compareceu"
          disabled={enviando}
          className="flex-1 rounded bg-herval-verde px-2 py-1 text-[10px] font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:opacity-60"
        >
          Compareceu
        </button>
        <button
          type="submit"
          name="status"
          value="Faltou"
          disabled={enviando}
          className="flex-1 rounded border border-black/20 px-2 py-1 text-[10px] font-extrabold text-black/65 transition-colors hover:border-herval-vermelho hover:text-herval-vermelho disabled:opacity-60"
        >
          Faltou
        </button>
      </div>
      {!estado.ok && estado.mensagem !== "" && (
        <p
          role="alert"
          className="mt-1.5 text-[10px] font-bold leading-snug text-herval-vermelho"
        >
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}

/** "Dra. Camila Rocha" vira "Dra. Camila", que cabe na coluna do dia. */
function primeiroNome(nome: string) {
  const partes = nome.split(" ");
  return partes.length > 2 ? `${partes[0]} ${partes[1]}` : nome;
}

function FormularioNovaConsulta({
  candidatos,
  clientes,
  unidades,
  equipe,
  procedimentos,
  diaSugerido,
  aoMarcar,
  aoFechar,
}: {
  candidatos: LeadDaAgenda[];
  clientes: ClienteDoCadastro[];
  unidades: UnidadeDoCadastro[];
  equipe: ProfissionalCadastrado[];
  procedimentos: EspecialidadeDoCadastro[];
  diaSugerido: string;
  aoMarcar: () => void;
  aoFechar: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    marcarConsulta,
    RESULTADO_INICIAL,
  );

  const [leadId, setLeadId] = useState<number | "">(candidatos[0]?.id ?? "");
  const [unidadeId, setUnidadeId] = useState<number | "">("");
  const [procedimentoId, setProcedimentoId] = useState<number | "">("");
  const [pessoaId, setPessoaId] = useState<number | "">("");

  useQuandoDerCerto(estado, aoMarcar);

  const lead = candidatos.find((c) => c.id === leadId);
  const cliente = clientes.find((c) => c.id === lead?.clienteId);

  /**
   * A consulta acontece em uma unidade do cliente do lead. Lead sem cliente
   * ainda não tem onde ser atendido, e a lista fica vazia de propósito: melhor
   * do que oferecer a unidade de outra clínica.
   */
  const unidadesDoCliente = cliente
    ? unidades.filter((u) => u.clienteId === cliente.id)
    : [];
  const unidadeEscolhida =
    unidadesDoCliente.find((u) => u.id === unidadeId) ?? unidadesDoCliente[0];

  /** Quem atende naquele lugar. */
  const naUnidade = unidadeEscolhida
    ? equipe.filter((p) => p.unidades.some((u) => u.id === unidadeEscolhida.id))
    : [];

  /**
   * O que dá para marcar ali é o que a equipe daquele lugar realiza — a mesma
   * regra da tela de Atendimento: o que uma clínica atende sai da equipe dela, e
   * não de uma lista à parte que alguém teria de manter igual.
   */
  const idsQueAEquipeRealiza = new Set(
    naUnidade.flatMap((p) => p.especialidades.map((e) => e.id)),
  );
  const oferecidos = procedimentos.filter(
    (p) => p.ativa && idsQueAEquipeRealiza.has(p.id),
  );
  const procedimentoEscolhido =
    oferecidos.find((p) => p.id === procedimentoId) ??
    oferecidos.find((p) => p.id === lead?.especialidadeInteresseId);

  /** Só quem realiza o procedimento escolhido, naquele lugar. */
  const habilitados = procedimentoEscolhido
    ? naUnidade.filter((p) =>
        p.especialidades.some((e) => e.id === procedimentoEscolhido.id),
      )
    : naUnidade;
  const pessoaEscolhida = habilitados.find((p) => p.id === pessoaId);

  return (
    <section className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-herval-preto">
            Nova consulta
          </h3>
          <p className="mt-1 text-xs font-medium text-black/50">
            Marca um horário para um lead que já está em etapa de agenda no
            Funil. Se ele já tiver uma consulta em aberto, ela é remarcada.
          </p>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar formulário"
          className="shrink-0 rounded-full p-1 text-black/40 transition-colors hover:bg-black/5 hover:text-herval-preto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {candidatos.length === 0 ? (
        <p className="mt-5 rounded-controle bg-black/[0.03] px-4 py-4 text-sm font-medium text-black/60">
          Nenhum lead está esperando horário. Para marcar uma consulta, mova um
          lead para Agendamento no Funil.
        </p>
      ) : (
        <form action={executar} className="mt-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <Escolha rotulo="Lead" obrigatorio>
              <select
                name="lead"
                value={leadId}
                onChange={(e) => {
                  setLeadId(Number(e.target.value));
                  // O cliente muda, e com ele as unidades e a equipe.
                  setUnidadeId("");
                  setProcedimentoId("");
                  setPessoaId("");
                }}
                className={campoBase}
              >
                {candidatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Escolha>

            <Escolha rotulo="Unidade" obrigatorio>
              <select
                name="unidade"
                value={unidadeEscolhida?.id ?? ""}
                onChange={(e) => setUnidadeId(Number(e.target.value))}
                disabled={unidadesDoCliente.length === 0}
                className={campoBase}
              >
                {unidadesDoCliente.length === 0 && (
                  <option value="">Este lead não tem cliente definido</option>
                )}
                {unidadesDoCliente.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </Escolha>

            <Escolha rotulo="Procedimento">
              <select
                name="procedimento"
                value={procedimentoEscolhido?.id ?? ""}
                onChange={(e) => {
                  setProcedimentoId(
                    e.target.value === "" ? "" : Number(e.target.value),
                  );
                  setPessoaId("");
                }}
                className={campoBase}
              >
                <option value="">A definir</option>
                {oferecidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Escolha>

            <Escolha rotulo="Profissional">
              <select
                name="profissional"
                value={pessoaEscolhida?.id ?? ""}
                onChange={(e) =>
                  setPessoaId(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className={campoBase}
              >
                <option value="">A definir</option>
                {habilitados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Escolha>

            <Escolha rotulo="Dia" obrigatorio>
              <input
                type="date"
                name="dia"
                defaultValue={diaSugerido}
                required
                className={campoBase}
              />
            </Escolha>

            <Escolha rotulo="Hora">
              <input type="time" name="hora" className={campoBase} />
            </Escolha>
          </div>

          <label className="block">
            <span className={estiloRotulo}>Observação</span>
            <textarea
              name="observacao"
              rows={2}
              maxLength={500}
              placeholder="O que o paciente pediu, o que a clínica precisa lembrar."
              className={campoBase}
            />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={enviando || unidadesDoCliente.length === 0}
              className={botaoPrincipal}
            >
              <CalendarPlus className="h-4 w-4" />
              {enviando ? "Marcando…" : "Marcar consulta"}
            </button>
            <Aviso estado={estado} />
          </div>
        </form>
      )}
    </section>
  );
}

function Escolha({
  rotulo: texto,
  obrigatorio = false,
  children,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={estiloRotulo}>
        {texto}
        {!obrigatorio && (
          <span className="ml-1 font-medium normal-case text-black/35">
            opcional
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
