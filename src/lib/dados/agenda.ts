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
  observacao: string | null;
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
   * É uma lista maior que `leads` de propósito. O Funil ainda não grava etapa no
   * banco, então esperar o lead chegar em "Agendamento" por lá era esperar uma
   * coisa que não acontece: o lead real entrava pelo WhatsApp em "Leads
   * Recebidos" e nunca saía de lá, e a Agenda ficava vazia para sempre. Marcar
   * daqui é o que move o lead para "Agendamento" — quem grava a etapa é
   * `marcarConsulta`.
   */
  candidatos: LeadDaAgenda[];
  pessoas: ProfissionalCadastrado[];
  clientes: ClienteDoCadastro[];
  procedimentos: EspecialidadeDoCadastro[];
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
  "id, lead_id, unidade_id, profissional_id, especialidade_id, data_consulta, hora_consulta, status, confirmada, fechado_por, observacao";

const CAMPOS_DO_LEAD =
  "id, nome, telefone, etapa, clinica_id, especialidade_interesse_id";

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
  const [cadastro, respostaConsultas, respostaDosLeads] = await Promise.all([
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

  const consultas = linhasDeConsulta.map((linha): Consulta => ({
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
    observacao: (linha.observacao ?? "").trim() || null,
  }));

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
    falha: null,
    // O aviso do cadastro vem de outra leitura e vale tanto quanto este.
    aviso:
      cortadas.length > 0
        ? `A tela está mostrando no máximo ${TETO_DE_LINHAS} linhas de ${cortadas.join(" e ")}. Nada foi perdido no banco, mas esta lista não está completa.`
        : cadastro.aviso,
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
