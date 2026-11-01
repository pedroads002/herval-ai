/**
 * A via de leitura da Agenda.
 *
 * Até aqui esta tela lia arquivos fixos e vazios no código: marcar uma consulta
 * mudava a memória do navegador e sumia ao recarregar a página. Agora a consulta
 * mora em `agendamentos` no banco, e o lead em `leads`.
 *
 * As pessoas, as unidades e os procedimentos saem de `carregarProfissionais`, a
 * mesma leitura da tela de Clientes. É de propósito: quem atende onde, e quem
 * realiza o quê, é a informação que o cadastro define, e ler de dois lugares
 * diferentes é como as duas telas passariam a discordar uma da outra.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import {
  carregarProfissionais,
  type ClienteDoCadastro,
  type EspecialidadeDoCadastro,
  type ProfissionalCadastrado,
} from "@/lib/dados/profissionais";
import { etapasComAgenda } from "@/data/agenda";
import { canaisDeFechamento, type CanalDeFechamento } from "@/lib/acoes/consultaDoFormulario";

/** Os desfechos que uma consulta marcada pode ter. */
export type StatusDaConsulta =
  "Agendada" | "Compareceu" | "Faltou" | "Cancelada";

export const statusPossiveis: StatusDaConsulta[] = [
  "Agendada",
  "Compareceu",
  "Faltou",
  "Cancelada",
];

/** Quem travou o agendamento: a IA sozinha ou um atendente do CRC. */
export type FechadoPor = "IA" | "CRC";

export type Consulta = {
  id: number;
  leadId: number;
  /** Onde o paciente deve aparecer. Sempre existe. */
  unidadeId: number;
  /** Nulo enquanto ninguém distribuiu a consulta na equipe. */
  profissionalId: number | null;
  especialidadeId: number | null;
  /** "AAAA-MM-DD", como o banco guarda: dia, sem hora e sem fuso. */
  dia: string;
  /** "HH:MM". Nulo quando só o dia foi combinado. */
  hora: string | null;
  status: StatusDaConsulta;
  confirmada: boolean;
  fechadoPor: FechadoPor;
  /** Como o agendamento foi fechado com o lead. Nulo em consulta antiga, de antes deste campo existir. */
  canalFechamento: CanalDeFechamento | null;
  observacao: string | null;
};

/**
 * Um horário que está ocupado na Google Agenda da clínica.
 *
 * Não é consulta: a linha vem de `agenda_ocupados`, que é espelho do calendário
 * real — lead da Helô, paciente que marcou por fora, compromisso pessoal, tudo
 * junto. Não tem lead, não tem profissional e não abre nada ao clicar; serve só
 * para a equipe ver que aquela faixa não está livre.
 *
 * `dia` e `hora` já vêm convertidos para o fuso de Brasília aqui no servidor,
 * no mesmo formato que a grade usa para a consulta ("AAAA-MM-DD" e "HH:MM").
 * Deixar o `timestamptz` cru chegar no navegador faria a mesma faixa aparecer em
 * hora diferente para quem abrisse o painel de outro fuso.
 */
export type HorarioOcupado = {
  id: number;
  /**
   * De qual cliente é esta agenda. A grade filtra por isso: a Google Agenda de
   * uma clínica não pode aparecer quando a tela está olhando outra.
   */
  clienteId: number;
  titulo: string | null;
  dia: string;
  hora: string;
  horaFim: string;
};

/** O lead como a Agenda precisa dele: quem é, e de qual cliente. */
export type LeadDaAgenda = {
  id: number;
  nome: string;
  telefone: string | null;
  etapa: string;
  clienteId: number | null;
  especialidadeInteresseId: number | null;
};

export type DadosDaAgenda = {
  consultas: Consulta[];
  /**
   * Os leads que a tela precisa nomear: os que estão em etapa de agenda no
   * Funil, mais os de qualquer consulta já marcada. Os dois grupos não são o
   * mesmo — quem compareceu e foi para "Venda Ganha" saiu das etapas de agenda e
   * a consulta dele continua na grade.
   */
  leads: LeadDaAgenda[];
  /**
   * Quem pode receber um horário: todo lead real do banco, em qualquer etapa.
   *
   * É uma lista maior que `leads` de propósito: marcar daqui é o que move o lead
   * para "Agendamento" — quem grava a etapa é `marcarConsulta`. Exigir que ele já
   * estivesse em "Agendamento" para poder ser marcado fecharia o círculo, e a
   * Agenda ficaria vazia para sempre esperando alguém chegar lá sozinho.
   */
  candidatos: LeadDaAgenda[];
  pessoas: ProfissionalCadastrado[];
  clientes: ClienteDoCadastro[];
  procedimentos: EspecialidadeDoCadastro[];
  /** O que está ocupado na Google Agenda da clínica, para a grade escurecer. */
  ocupados: HorarioOcupado[];
  /**
   * Os clientes que têm `google_calendar_id` preenchido. É o que decide qual
   * aviso de sincronização a tela mostra: quem tem Google Agenda conectada não
   * precisa ler que "nada foi sincronizado".
   *
   * É uma lista, e não um sim/não, porque a grade filtra por unidade: o aviso
   * tem de falar do cliente que está na tela, não de qualquer um que exista.
   */
  clientesComGoogleAgenda: number[];
  falha: string | null;
  aviso: string | null;
};

/** Ver o mesmo raciocínio em `dados/procedimentos.ts`. */
const TETO_DE_LINHAS = 1000;

const SEM_DADOS: DadosDaAgenda = {
  consultas: [],
  leads: [],
  candidatos: [],
  pessoas: [],
  clientes: [],
  procedimentos: [],
  ocupados: [],
  clientesComGoogleAgenda: [],
  falha: null,
  aviso: null,
};

type LinhaDeAgendamento = {
  id: number;
  lead_id: number;
  unidade_id: number;
  profissional_id: number | null;
  especialidade_id: number | null;
  data_consulta: string;
  hora_consulta: string | null;
  status: string;
  confirmada: boolean;
  fechado_por: string;
  canal_fechamento: string | null;
  observacao: string | null;
};

type LinhaDeLead = {
  id: number;
  nome: string | null;
  telefone: string | null;
  etapa: string;
  clinica_id: number | null;
  especialidade_interesse_id: number | null;
};

const CAMPOS_DO_AGENDAMENTO =
  "id, lead_id, unidade_id, profissional_id, especialidade_id, data_consulta, hora_consulta, status, confirmada, fechado_por, canal_fechamento, observacao";

const CAMPOS_DO_LEAD =
  "id, nome, telefone, etapa, clinica_id, especialidade_interesse_id";

type LinhaDeOcupado = {
  id: number;
  clinica_id: number;
  titulo: string | null;
  inicio: string;
  fim: string;
};

export async function carregarAgenda(): Promise<DadosDaAgenda> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  // O cadastro e as consultas são lidos juntos: nenhuma das duas depende da
  // outra para ser pedida.
  const [
    cadastro,
    respostaConsultas,
    respostaDosLeads,
    respostaOcupados,
    respostaClinicas,
  ] = await Promise.all([
    carregarProfissionais(),
    supabase
      .from("agendamentos")
      .select(CAMPOS_DO_AGENDAMENTO)
      .order("data_consulta", { ascending: true })
      .limit(TETO_DE_LINHAS),
    // Todos os leads, de qualquer etapa. Filtrar por etapa de agenda aqui era o
    // que fechava o círculo: só quem já estava em "Agendamento" podia ser
    // marcado, e só marcando é que alguém chega em "Agendamento".
    supabase
      .from("leads")
      .select(CAMPOS_DO_LEAD)
      .order("nome", { ascending: true })
      .limit(TETO_DE_LINHAS),
    // O espelho da Google Agenda. A RLS devolve só o que o usuário pode ver, do
    // mesmo jeito que em `agendamentos` — e, para quem é da Herval, isso é a
    // agenda de todas as clínicas. Por isso `clinica_id` vem junto: é a tela que
    // tem de mostrar cada agenda apenas no cliente a que ela pertence.
    supabase
      .from("agenda_ocupados")
      .select("id, clinica_id, titulo, inicio, fim")
      .order("inicio", { ascending: true })
      .limit(TETO_DE_LINHAS),
    // Quais clientes têm Google Agenda conectada: é isso que troca o texto do
    // aviso de sincronização, cliente por cliente.
    supabase.from("clinicas").select("id, google_calendar_id"),
  ]);

  if (cadastro.falha) return { ...SEM_DADOS, falha: cadastro.falha };

  const erro = respostaConsultas.error ?? respostaDosLeads.error;
  if (erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler a agenda: ${erro.message}`,
    };
  }

  const linhasDeConsulta = (respostaConsultas.data ??
    []) as LinhaDeAgendamento[];
  const linhasDeLead = (respostaDosLeads.data ?? []) as LinhaDeLead[];

  // Estas duas leituras não derrubam a tela: a Agenda é a lista de consultas, e
  // o espelho do Google é informação a mais. Se ele falhar, a grade continua
  // mostrando o que o CRC marcou, em vez de virar uma tela de erro.
  const ocupados = ((respostaOcupados.data ?? []) as LinhaDeOcupado[])
    .map(linhaParaOcupado)
    .filter((o): o is HorarioOcupado => o !== null);

  const clientesComGoogleAgenda = (
    (respostaClinicas.data ?? []) as {
      id: number;
      google_calendar_id: string | null;
    }[]
  )
    .filter((c) => (c.google_calendar_id ?? "").trim() !== "")
    .map((c) => c.id);

  // Consulta de lead que ficou fora do teto de linhas: sem esta segunda leitura
  // o cartão dele apareceria na grade sem nome, porque o lead não veio.
  const jaTemos = new Set(linhasDeLead.map((l) => l.id));
  const faltando = [
    ...new Set(
      linhasDeConsulta.map((c) => c.lead_id).filter((id) => !jaTemos.has(id)),
    ),
  ];

  if (faltando.length > 0) {
    const { data, error } = await supabase
      .from("leads")
      .select(CAMPOS_DO_LEAD)
      .in("id", faltando)
      .limit(TETO_DE_LINHAS);

    if (error) {
      return {
        ...SEM_DADOS,
        falha: `Não deu para ler os leads das consultas: ${error.message}`,
      };
    }

    linhasDeLead.push(...((data ?? []) as LinhaDeLead[]));
  }

  const consultas = linhasDeConsulta.map(linhaParaConsulta);

  const candidatos = linhasDeLead.map((linha): LeadDaAgenda => ({
    id: linha.id,
    nome: (linha.nome ?? "").trim() || "Lead sem nome",
    telefone: (linha.telefone ?? "").trim() || null,
    etapa: linha.etapa,
    clienteId: linha.clinica_id,
    especialidadeInteresseId: linha.especialidade_interesse_id,
  }));

  // A grade e a lista de "Aguardando horário" continuam olhando só as etapas de
  // agenda: quem está em "Leads Recebidos" pode ser marcado, mas não é alguém
  // que a Agenda esteja esperando dar horário.
  const deAgenda = new Set<string>(etapasComAgenda);
  const temConsulta = new Set(linhasDeConsulta.map((c) => c.lead_id));
  const leads = candidatos.filter(
    (lead) => deAgenda.has(lead.etapa) || temConsulta.has(lead.id),
  );

  const cortadas = [
    consultas.length >= TETO_DE_LINHAS ? "consultas" : null,
    candidatos.length >= TETO_DE_LINHAS ? "leads" : null,
  ].filter((nome): nome is string => nome !== null);

  return {
    consultas,
    leads,
    candidatos,
    pessoas: cadastro.profissionais,
    clientes: cadastro.clientes,
    procedimentos: cadastro.especialidades,
    ocupados,
    clientesComGoogleAgenda,
    falha: null,
    // O aviso do cadastro vem de outra leitura e vale tanto quanto este.
    aviso:
      cortadas.length > 0
        ? `A tela está mostrando no máximo ${TETO_DE_LINHAS} linhas de ${cortadas.join(" e ")}. Nada foi perdido no banco, mas esta lista não está completa.`
        : cadastro.aviso,
  };
}

const FUSO_DE_BRASILIA = "America/Sao_Paulo";

const PARTES_EM_BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_DE_BRASILIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Um `timestamptz` do banco vira o par dia/hora que a grade compara.
 *
 * `formatToParts` em vez de montar a string: é o jeito de pegar ano, mês, dia e
 * hora já no fuso de Brasília sem depender da ordem com que cada locale escreve
 * a data.
 */
function emBrasilia(iso: string) {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return null;

  const partes: Record<string, string> = {};
  for (const parte of PARTES_EM_BRASILIA.formatToParts(quando)) {
    if (parte.type !== "literal") partes[parte.type] = parte.value;
  }

  const { year, month, day, hour, minute } = partes;
  if (!year || !month || !day || !hour || !minute) return null;

  // "24:00" aparece em alguns ambientes para a meia-noite com hour12 false.
  const horaCheia = hour === "24" ? "00" : hour;

  return { dia: `${year}-${month}-${day}`, hora: `${horaCheia}:${minute}` };
}

/** Uma linha de `agenda_ocupados` como a grade usa. */
function linhaParaOcupado(linha: LinhaDeOcupado): HorarioOcupado | null {
  const inicio = emBrasilia(linha.inicio);
  const fim = emBrasilia(linha.fim);
  if (!inicio) return null;

  return {
    id: linha.id,
    clienteId: linha.clinica_id,
    titulo: (linha.titulo ?? "").trim() || null,
    dia: inicio.dia,
    hora: inicio.hora,
    horaFim: fim ? fim.hora : inicio.hora,
  };
}

/** "09:00:00" do banco vira "09:00", que é o que a grade compara. */
function horaCurta(valor: string | null) {
  if (!valor) return null;
  return valor.slice(0, 5);
}

/**
 * O CHECK da tabela só deixa entrar um dos quatro, mas o tipo que volta do
 * PostgREST é texto: confiar nele sem conferir deixaria um status desconhecido
 * escapar para dentro do `Record` de estilos e a grade renderizar sem cor.
 */
function statusValido(valor: string): StatusDaConsulta {
  return (statusPossiveis as string[]).includes(valor)
    ? (valor as StatusDaConsulta)
    : "Agendada";
}

/** Uma linha de `agendamentos` como a tela usa, em qualquer leitura. */
function linhaParaConsulta(linha: LinhaDeAgendamento): Consulta {
  return {
    id: linha.id,
    leadId: linha.lead_id,
    unidadeId: linha.unidade_id,
    profissionalId: linha.profissional_id,
    especialidadeId: linha.especialidade_id,
    dia: linha.data_consulta,
    hora: horaCurta(linha.hora_consulta),
    status: statusValido(linha.status),
    confirmada: linha.confirmada,
    fechadoPor: linha.fechado_por === "IA" ? "IA" : "CRC",
    canalFechamento: canaisDeFechamento.includes(
      linha.canal_fechamento as CanalDeFechamento,
    )
      ? (linha.canal_fechamento as CanalDeFechamento)
      : null,
    observacao: (linha.observacao ?? "").trim() || null,
  };
}

/**
 * As consultas de um lead só — o Atendimento mostra o que já está marcado
 * sem carregar a agenda inteira, que é informação de todos os leads.
 */
export async function carregarConsultasDoLead(
  leadId: number,
): Promise<Consulta[]> {
  if (!supabaseConfigurado() || !Number.isInteger(leadId) || leadId <= 0) {
    return [];
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("agendamentos")
    .select(CAMPOS_DO_AGENDAMENTO)
    .eq("lead_id", leadId)
    .order("data_consulta", { ascending: true });

  if (error || !data) return [];

  return (data as LinhaDeAgendamento[]).map(linhaParaConsulta);
}
