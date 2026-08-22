"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicaPorId, nomeDaClinica, oferece } from "@/data/clinicas";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Info,
  RefreshCw,
  X,
} from "lucide-react";
import { useLeads, type DadosDaConsulta } from "@/components/ProvedorLeads";
import {
  dataCompleta,
  dataDaConsulta,
  diaEMes,
  etapaTemAgenda,
  horaEmIntervalo,
  horariosGrade,
  inicioDaSemana,
  inicioDoDia,
  intervaloDaSemana,
  intervalosPorProfissional,
  mesmaData,
  nomesCurtosDosDias,
  nomesDosDias,
  somarDias,
  statusDaConsulta,
  diasAteAData,
  type StatusConsulta,
} from "@/data/agenda";
import { especialidadesIniciais, especialidadePorId } from "@/data/especialidades";
import {
  profissionaisDisponiveis,
  profissionaisIniciais,
} from "@/data/profissionais";
import type { Agendamento } from "@/data/agendamentos";
import type { Tarefa } from "@/data/tarefas";
import { formatarDuracao } from "@/lib/formato";

type Modo = "Dia" | "Semana";

/** Consulta pronta para a grade: o lead junto do agendamento dele. */
type ItemAgenda = {
  tarefa: Tarefa;
  agendamento: Agendamento;
  data: Date;
  status: StatusConsulta;
};

const estiloStatus: Record<StatusConsulta, string> = {
  Agendado: "border border-black/25 text-black/70",
  Confirmado: "bg-herval-verde text-herval-preto",
  Compareceu: "bg-herval-preto text-herval-branco",
  Faltou: "bg-herval-vermelho text-herval-branco",
  Cancelada: "border border-black/25 text-black/40 line-through",
};

export default function PainelAgenda() {
  const { tarefas, agendamentos, definirConsulta, definirStatusDoAgendamento } =
    useLeads();

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
  const [filtroProfissional, setFiltroProfissional] = useState<"todos" | number>(
    "todos",
  );
  const [formAberto, setFormAberto] = useState(false);
  const [avisoSincronizar, setAvisoSincronizar] = useState(false);

  /** Leads que estão nas etapas de agenda do Funil. */
  const leadsDaAgenda = useMemo(
    () => tarefas.filter((t) => etapaTemAgenda(t.etapa)),
    [tarefas],
  );

  /**
   * A grade só desenha agendamento com horário montado. O resto do histórico
   * tem só o dia, e aparece em "Aguardando horário" em vez de ganhar um
   * horário inventado.
   */
  const comHorario = useMemo(
    () => agendamentos.filter((a) => a.hora !== null && a.status !== "Cancelada"),
    [agendamentos],
  );

  /**
   * Quem está sem data marcada. Inclui quem faltou: o agendamento dele existe,
   * mas está encerrado, então ele precisa de horário novo. Quem já compareceu
   * não entra — a consulta dele acabou.
   */
  const semHorario = useMemo(() => {
    const comDataAberta = new Set(
      agendamentos.filter((a) => a.status === "Agendada").map((a) => a.leadId),
    );
    return leadsDaAgenda.filter(
      (t) => t.etapa !== "Comparecimento" && !comDataAberta.has(t.id),
    );
  }, [leadsDaAgenda, agendamentos]);

  const itens = useMemo<ItemAgenda[]>(() => {
    if (!hoje) return [];
    const porId = new Map(tarefas.map((t) => [t.id, t]));

    return comHorario
      .map((agendamento) => {
        const tarefa = porId.get(agendamento.leadId);
        if (!tarefa) return null;
        return {
          tarefa,
          agendamento,
          data: dataDaConsulta(agendamento, hoje),
          status: statusDaConsulta(agendamento),
        };
      })
      .filter((item): item is ItemAgenda => item !== null)
      .filter(
        (item) =>
          filtroProfissional === "todos" ||
          item.agendamento.profissionalId === filtroProfissional,
      );
  }, [comHorario, tarefas, hoje, filtroProfissional]);

  const profissionaisVisiveis = useMemo(
    () =>
      filtroProfissional === "todos"
        ? profissionaisIniciais
        : profissionaisIniciais.filter((p) => p.id === filtroProfissional),
    [filtroProfissional],
  );

  if (!hoje || !referencia) {
    return (
      <p className="text-sm font-medium text-black/45">Carregando a agenda...</p>
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
              aria-label={modo === "Semana" ? "Semana anterior" : "Dia anterior"}
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
            <span className="sr-only">Profissional</span>
            <select
              value={filtroProfissional}
              onChange={(e) =>
                setFiltroProfissional(
                  e.target.value === "todos" ? "todos" : Number(e.target.value),
                )
              }
              className="rounded-full border border-black/15 bg-herval-branco px-4 py-2.5 text-sm font-bold text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
            >
              <option value="todos">Todos os profissionais</option>
              {profissionaisIniciais.map((p) => (
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
            title="Sincronização real disponível quando a integração for conectada"
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
              Nada foi sincronizado: este é um ambiente de demonstração.
            </p>
            <p className="mt-1.5">
              A sincronização real com Clinicorp, Simples Dental ou Dental Office
              fica disponível quando a integração for conectada na tela de
              Integrações. Enquanto isso, a Agenda mostra apenas os leads que já
              estão em Agendamento, Reagendamento ou Comparecimento no Funil.
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
          semHorario={semHorario}
          diasDaSemana={Array.from({ length: 7 }, (_, i) => somarDias(domingo, i))}
          hoje={hoje}
          aoMarcar={(leadId, dados) => {
            definirConsulta(leadId, dados);
            setFormAberto(false);
          }}
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
          {leadsDaAgenda.length} leads em Agendamento, Reagendamento ou
          Comparecimento no Funil
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
            {semHorario.map((tarefa) => (
              <li
                key={tarefa.id}
                className="rounded-controle border border-black/10 bg-black/[0.03] px-3.5 py-2.5"
              >
                <p className="text-sm font-bold text-herval-preto">
                  {tarefa.lead}
                </p>
                <p className="text-xs font-medium text-black/45">
                  {tarefa.telefone} · {tarefa.etapa}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modo === "Semana" ? (
        <GradeSemana
          dias={diasVisiveis}
          hoje={hoje}
          itens={itens}
          profissionais={profissionaisVisiveis}
        />
      ) : (
        <GradeDia
          dia={referencia}
          itens={itens}
          profissionais={profissionaisVisiveis}
        />
      )}
    </div>
  );
}

/** Grade semanal: linhas de hora, colunas de dia. */
function GradeSemana({
  dias,
  hoje,
  itens,
  profissionais,
}: {
  dias: Date[];
  hoje: Date;
  itens: ItemAgenda[];
  profissionais: typeof profissionaisIniciais;
}) {
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

        {horariosGrade.map((hora) => (
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
                  mesmaData(item.data, dia) && item.agendamento.hora === hora,
              );

              // Intervalos valem de segunda a sexta.
              const diaUtil = dia.getDay() >= 1 && dia.getDay() <= 5;
              const emIntervalo = diaUtil
                ? profissionais.filter((p) => {
                    const intervalo = intervalosPorProfissional[p.id];
                    return intervalo && horaEmIntervalo(hora, intervalo);
                  })
                : [];

              return (
                <div
                  key={dia.toISOString()}
                  className="min-h-[3.5rem] space-y-1.5 border-l border-black/10 p-1.5"
                >
                  {/* Com vários profissionais em intervalo na mesma hora, um
                      único bloco resumido mantém a grade legível. */}
                  {emIntervalo.length > 0 && (
                    <p
                      title={`Intervalo: ${emIntervalo.map((p) => p.nome).join(", ")}`}
                      className="flex items-center gap-1 rounded bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.05)_0px,rgba(0,0,0,0.05)_6px,transparent_6px,transparent_12px)] px-2 py-1 text-[10px] font-bold text-black/40"
                    >
                      <Coffee className="h-3 w-3 shrink-0" />
                      {emIntervalo.length === 1
                        ? `Intervalo · ${primeiroNome(emIntervalo[0].nome)}`
                        : `Intervalo · ${emIntervalo.length} profissionais`}
                    </p>
                  )}

                  {doDia.map((item) => (
                    <CartaoConsulta key={item.tarefa.id} item={item} compacto />
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
  itens,
  profissionais,
}: {
  dia: Date;
  itens: ItemAgenda[];
  profissionais: typeof profissionaisIniciais;
}) {
  const doDia = itens.filter((item) => mesmaData(item.data, dia));
  const diaUtil = dia.getDay() >= 1 && dia.getDay() <= 5;

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2 md:-mx-10 md:px-10">
      <div className="min-w-[64rem] overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        <div
          className="grid border-b border-black/10 bg-black/[0.03]"
          style={{
            gridTemplateColumns: `5rem repeat(${profissionais.length}, minmax(0,1fr))`,
          }}
        >
          <div className="px-3 py-3" />
          {profissionais.map((p) => (
            <div key={p.id} className="border-l border-black/10 px-3 py-3">
              <p className="text-sm font-extrabold text-herval-preto">
                {p.nome}
              </p>
              <p className="text-xs font-medium text-black/45">{p.tipo}</p>
            </div>
          ))}
        </div>

        {horariosGrade.map((hora) => (
          <div
            key={hora}
            className="grid border-b border-black/[0.07] last:border-b-0"
            style={{
              gridTemplateColumns: `5rem repeat(${profissionais.length}, minmax(0,1fr))`,
            }}
          >
            <div className="px-3 py-3 text-xs font-bold tabular-nums text-black/40">
              {hora}
            </div>

            {profissionais.map((p) => {
              const intervalo = intervalosPorProfissional[p.id];
              const bloqueado =
                diaUtil && intervalo && horaEmIntervalo(hora, intervalo);
              const consultas = doDia.filter(
                (item) =>
                  item.agendamento.profissionalId === p.id &&
                  item.agendamento.hora === hora,
              );

              return (
                <div
                  key={p.id}
                  className="min-h-[3.5rem] space-y-1.5 border-l border-black/10 p-1.5"
                >
                  {bloqueado && (
                    <p className="flex items-center gap-1.5 rounded bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.05)_0px,rgba(0,0,0,0.05)_6px,transparent_6px,transparent_12px)] px-2 py-2 text-[11px] font-bold text-black/40">
                      <Coffee className="h-3 w-3 shrink-0" />
                      {intervalo.rotulo}
                    </p>
                  )}

                  {consultas.map((item) => (
                    <CartaoConsulta key={item.tarefa.id} item={item} />
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
}: {
  item: ItemAgenda;
  compacto?: boolean;
}) {
  // Pega a ação direto do contexto: passar por duas grades só para repassar
  // uma função deixaria as duas com um parâmetro que elas não usam.
  const { definirStatusDoAgendamento } = useLeads();
  const especialidade = especialidadePorId(item.agendamento.especialidadeId ?? 0);
  // Consulta que já passou da data e ainda está sem desfecho.
  const aguardaDesfecho =
    item.agendamento.status === "Agendada" && item.agendamento.consultaEmDias >= 0;
  const profissional = profissionaisIniciais.find(
    (p) => p.id === item.agendamento.profissionalId,
  );

  return (
    <article className="rounded-controle border border-black/10 bg-herval-branco p-2.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-extrabold tabular-nums text-herval-preto">
          {item.agendamento.hora}
        </p>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-bold",
            estiloStatus[item.status],
          ].join(" ")}
        >
          {item.status}
        </span>
      </div>

      <p className="mt-1 text-xs font-bold leading-tight text-herval-preto">
        {item.tarefa.lead}
      </p>

      {especialidade && (
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-black/50">
          {especialidade.nome} · {formatarDuracao(especialidade.duracaoMinutos)}
        </p>
      )}

      {compacto && profissional && (
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-black/45">
          {primeiroNome(profissional.nome)}
        </p>
      )}

      {!compacto && (
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-black/45">
          {item.tarefa.telefone} · {nomeDaClinica(item.tarefa.clinicaId)}
        </p>
      )}

      {aguardaDesfecho && (
        // Marcar o desfecho move o lead de etapa sozinho: quem comparece vai
        // para "Comparecimento", quem falta cai em "Reagendamento".
        <div className="mt-2 flex gap-1.5 border-t border-black/10 pt-2">
          <button
            type="button"
            onClick={() =>
              definirStatusDoAgendamento(item.agendamento.id, "Compareceu")
            }
            className="flex-1 rounded bg-herval-verde px-2 py-1 text-[10px] font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
          >
            Compareceu
          </button>
          <button
            type="button"
            onClick={() =>
              definirStatusDoAgendamento(item.agendamento.id, "Faltou")
            }
            className="flex-1 rounded border border-black/20 px-2 py-1 text-[10px] font-extrabold text-black/65 transition-colors hover:border-herval-vermelho hover:text-herval-vermelho"
          >
            Faltou
          </button>
        </div>
      )}
    </article>
  );
}

/** "Dra. Camila Rocha" vira "Dra. Camila", que cabe na coluna do dia. */
function primeiroNome(nome: string) {
  const partes = nome.split(" ");
  return partes.length > 2 ? `${partes[0]} ${partes[1]}` : nome;
}

function FormularioNovaConsulta({
  semHorario,
  diasDaSemana,
  hoje,
  aoMarcar,
  aoFechar,
}: {
  semHorario: Tarefa[];
  diasDaSemana: Date[];
  hoje: Date;
  aoMarcar: (leadId: number, dados: DadosDaConsulta) => void;
  aoFechar: () => void;
}) {
  const [leadId, setLeadId] = useState<number | "">(semHorario[0]?.id ?? "");
  const [especialidadeId, setEspecialidadeId] = useState<number>(1);
  const [diaIndice, setDiaIndice] = useState(1);
  const [hora, setHora] = useState("09:00");
  const [erro, setErro] = useState<string | null>(null);

  // A consulta acontece na clínica do lead, então é ela que decide o que dá
  // para oferecer: nem toda clínica faz todo procedimento, e nenhum
  // profissional atende em todas.
  const clinicaId = semHorario.find((t) => t.id === leadId)?.clinicaId ?? 0;
  const clinica = clinicaPorId(clinicaId);

  const ativas = especialidadesIniciais.filter(
    (e) => e.ativa && clinica !== undefined && oferece(clinica, e.id),
  );
  const especialidadeValida = ativas.some((e) => e.id === especialidadeId)
    ? especialidadeId
    : (ativas[0]?.id ?? 1);

  // Só aparecem os profissionais que atendem essa especialidade nessa clínica.
  const habilitados = profissionaisDisponiveis(clinicaId, especialidadeValida);
  const [profissionalId, setProfissionalId] = useState<number>(
    habilitados[0]?.id ?? 1,
  );
  const profissionalValido = habilitados.some((p) => p.id === profissionalId)
    ? profissionalId
    : (habilitados[0]?.id ?? 1);

  function marcar() {
    if (leadId === "") {
      setErro("Escolha o lead que vai ocupar o horário.");
      return;
    }

    const intervalo = intervalosPorProfissional[profissionalValido];
    if (intervalo && horaEmIntervalo(hora, intervalo)) {
      setErro(
        `Esse horário cai no ${intervalo.rotulo.toLowerCase()} do profissional. Escolha outro.`,
      );
      return;
    }

    const data = diasDaSemana[diaIndice];
    setErro(null);
    aoMarcar(Number(leadId), {
      profissionalId: profissionalValido,
      especialidadeId: especialidadeValida,
      consultaEmDias: diasAteAData(data, hoje),
      hora,
    });
  }

  return (
    <section className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-herval-preto">
            Nova consulta
          </h3>
          <p className="mt-1 text-xs font-medium text-black/50">
            Marca um horário para um lead que já está em etapa de agenda no
            Funil. Vale só nesta sessão: recarregar a página volta ao estado
            inicial.
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

      {semHorario.length === 0 ? (
        <p className="mt-5 rounded-controle bg-black/[0.03] px-4 py-4 text-sm font-medium text-black/60">
          Todos os leads em etapa de agenda já têm horário. Para marcar uma nova
          consulta, mova um lead para Agendamento no Funil.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-5">
            <Campo rotulo="Lead">
              <select
                value={leadId}
                onChange={(e) => setLeadId(Number(e.target.value))}
                className={estiloCampo}
              >
                {semHorario.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.lead}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Especialidade">
              <select
                value={especialidadeValida}
                onChange={(e) => setEspecialidadeId(Number(e.target.value))}
                className={estiloCampo}
              >
                {ativas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Profissional">
              <select
                value={profissionalValido}
                onChange={(e) => setProfissionalId(Number(e.target.value))}
                className={estiloCampo}
              >
                {habilitados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Dia">
              <select
                value={diaIndice}
                onChange={(e) => setDiaIndice(Number(e.target.value))}
                className={estiloCampo}
              >
                {diasDaSemana.map((dia, indice) => (
                  <option key={dia.toISOString()} value={indice}>
                    {nomesDosDias[dia.getDay()]} · {diaEMes(dia)}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Hora">
              <select
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={estiloCampo}
              >
                {horariosGrade.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {erro && (
            <p
              role="alert"
              className="mt-4 rounded-controle bg-herval-vermelho/10 px-4 py-3 text-sm font-bold text-herval-vermelho"
            >
              {erro}
            </p>
          )}

          <button
            type="button"
            onClick={marcar}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-herval-verde px-5 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
          >
            <CalendarPlus className="h-4 w-4" />
            Marcar consulta
          </button>
        </>
      )}
    </section>
  );
}

const estiloCampo =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-black/45">
        {rotulo}
      </span>
      {children}
    </label>
  );
}
