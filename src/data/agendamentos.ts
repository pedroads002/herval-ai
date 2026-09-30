import type { EtapaFunil } from "@/data/leads";
import { ETAPA_AGENDADO, ETAPA_COMPARECEU, ETAPA_REMARCAR } from "@/data/leads";

/** Status de uma consulta marcada. */
export type StatusAgendamento =
  "Agendada" | "Compareceu" | "Faltou" | "Cancelada";

export const statusAgendamento: StatusAgendamento[] = [
  "Agendada",
  "Compareceu",
  "Faltou",
  "Cancelada",
];

/** Quem travou o agendamento: a IA sozinha ou um atendente do CRC. */
export type FechadoPor = "IA" | "CRC";

/**
 * Um agendamento é o ato de marcar uma consulta, e esta lista é a **fonte
 * única** dela: a Agenda, o Funil e os Relatórios leem todos daqui. O mesmo
 * lead pode ter vários — remarcou, conta de novo.
 *
 * As duas datas medem coisas diferentes, e cada relatório usa uma:
 * `criadoHaDias` é quando a equipe marcou (produção), `consultaEmDias` é
 * quando o paciente é atendido (funil).
 *
 * Profissional, especialidade e hora só existem quando alguém montou a agenda
 * de verdade. Ficam nulos no histórico, e a Agenda mostra esses leads em
 * "Aguardando horário" em vez de inventar um horário que ninguém marcou.
 */
export type Agendamento = {
  id: number;
  leadId: number;
  clinicaId: number;
  /** Há quantos dias o agendamento foi criado. */
  criadoHaDias: number;
  /** Dias até a consulta. Positivo é passado, negativo é consulta futura. */
  consultaEmDias: number;
  status: StatusAgendamento;
  fechadoPor: FechadoPor;
  /** Id da tela de Profissionais. Nulo enquanto a agenda não for montada. */
  profissionalId: number | null;
  /** Id da tela de Especialidades. */
  especialidadeId: number | null;
  /** Hora de início, "HH:MM". Nulo quando só existe o dia. */
  hora: string | null;
  /** O paciente respondeu confirmando presença. */
  confirmada: boolean;
  /**
   * Recado livre de quem marcou: o que o paciente pediu, o que a clínica
   * precisa lembrar. Opcional, e ausente em tudo que já existia — ninguém
   * escreveu observação em consulta marcada antes de haver onde escrever.
   */
  observacao?: string;
};

/**
 * Para onde o sistema move o lead quando o agendamento muda de status. É a
 * regra automática: quem falta vai para remarcação, quem comparece avança.
 * Devolve nulo quando o status não manda mexer na etapa.
 */
export function etapaPorStatus(status: StatusAgendamento): EtapaFunil | null {
  if (status === "Compareceu") return ETAPA_COMPARECEU;
  if (status === "Faltou") return ETAPA_REMARCAR;
  if (status === "Agendada") return ETAPA_AGENDADO;
  return null;
}

/**
 * Formato compacto, como em `leadsHistoricos`. Cada linha é:
 * [id, leadId, clinicaId, criadoHaDias, consultaEmDias, status, fechadoPor,
 *  profissionalId, especialidadeId, hora, confirmada]
 * com status pela posição na lista, fechadoPor 0 = IA e 1 = CRC, 0 em
 * profissional e especialidade quando não há, hora como número inteiro (-1
 * quando não há) e confirmada como 0 ou 1.
 *
 * Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
 * Quando esta tela passar a ler o banco, é este array que some.
 */
type LinhaAgendamento = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const registros: LinhaAgendamento[] = [];

export const agendamentosIniciais: Agendamento[] = registros.map(
  ([
    id,
    leadId,
    clinicaId,
    criadoHaDias,
    consultaEmDias,
    status,
    fechado,
    prof,
    esp,
    hora,
    confirmada,
  ]) => ({
    id,
    leadId,
    clinicaId,
    criadoHaDias,
    consultaEmDias,
    status: statusAgendamento[status],
    fechadoPor: fechado === 0 ? "IA" : "CRC",
    profissionalId: prof > 0 ? prof : null,
    especialidadeId: esp > 0 ? esp : null,
    hora: hora >= 0 ? `${String(hora).padStart(2, "0")}:00` : null,
    confirmada: confirmada === 1,
  }),
);
