import type { Agendamento } from "@/data/agendamentos";
import type { EtapaFunil } from "@/data/leads";

/**
 * Etapas do Funil que aparecem na Agenda. A Agenda não tem base própria: ela
 * mostra os leads que já estão nessas etapas, com o horário e o profissional
 * definidos no próprio lead.
 */
export const etapasComAgenda: EtapaFunil[] = [
  "Agendamento",
  "Reagendamento",
  "Comparecimento",
];

export function etapaTemAgenda(etapa: EtapaFunil) {
  return etapasComAgenda.includes(etapa);
}

/** Faixa de funcionamento mostrada na grade. */
export const HORA_INICIO = 8;
export const HORA_FIM = 18;

/** Linhas da grade: "08:00" até "18:00". */
export const horariosGrade = Array.from(
  { length: HORA_FIM - HORA_INICIO + 1 },
  (_, i) => `${String(HORA_INICIO + i).padStart(2, "0")}:00`,
);

export const nomesDosDias = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const nomesCurtosDosDias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Bloqueio fixo na grade do profissional. Não é clicável. */
export type Intervalo = {
  rotulo: string;
  /** Hora de início, "HH:MM". */
  inicio: string;
  /** Hora de término, "HH:MM". */
  fim: string;
};

/**
 * Intervalo de cada profissional, por id da tela de Profissionais. Vale de
 * segunda a sexta: no fim de semana a clínica não tem escala fixa.
 */
export const intervalosPorProfissional: Record<number, Intervalo> = {
  1: { rotulo: "Almoço", inicio: "12:00", fim: "13:00" },
  2: { rotulo: "Almoço", inicio: "12:00", fim: "13:00" },
  3: { rotulo: "Almoço", inicio: "13:00", fim: "14:00" },
  4: { rotulo: "Almoço", inicio: "12:00", fim: "13:00" },
  5: { rotulo: "Almoço", inicio: "11:00", fim: "12:00" },
  6: { rotulo: "Almoço", inicio: "13:00", fim: "14:00" },
};

/** Verdadeiro quando a linha da grade cai dentro do intervalo do profissional. */
export function horaEmIntervalo(hora: string, intervalo: Intervalo) {
  return hora >= intervalo.inicio && hora < intervalo.fim;
}

export type StatusConsulta =
  | "Agendado"
  | "Confirmado"
  | "Compareceu"
  | "Faltou"
  | "Cancelada";

/**
 * O rótulo na grade sai do status do próprio agendamento, que agora é a fonte
 * única. "Confirmado" é o agendamento ainda aberto que o paciente respondeu.
 */
export function statusDaConsulta(agendamento: Agendamento): StatusConsulta {
  if (agendamento.status === "Compareceu") return "Compareceu";
  if (agendamento.status === "Faltou") return "Faltou";
  if (agendamento.status === "Cancelada") return "Cancelada";
  return agendamento.confirmada ? "Confirmado" : "Agendado";
}

// --- Datas -----------------------------------------------------------------

export function inicioDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

/** Domingo da semana em que a data cai. */
export function inicioDaSemana(data: Date) {
  const copia = inicioDoDia(data);
  copia.setDate(copia.getDate() - copia.getDay());
  return copia;
}

export function somarDias(data: Date, dias: number) {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function mesmaData(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Data real da consulta. `consultaEmDias` conta para trás: 3 é anteontem mais
 * um, -2 é depois de amanhã.
 */
export function dataDaConsulta(agendamento: Agendamento, hoje: Date) {
  return somarDias(hoje, -agendamento.consultaEmDias);
}

/** Quantos dias separam a data de hoje, no formato guardado no agendamento. */
export function diasAteAData(data: Date, hoje: Date) {
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round(
    (inicioDoDia(hoje).getTime() - inicioDoDia(data).getTime()) / umDia,
  );
}

/** Quantas semanas separam a data de referência da semana atual. */
export function semanasDeDiferenca(data: Date, hoje: Date) {
  const umDia = 24 * 60 * 60 * 1000;
  const diferenca =
    inicioDaSemana(data).getTime() - inicioDaSemana(hoje).getTime();
  return Math.round(diferenca / (7 * umDia));
}

/** "13/08" — dia e mês, sem depender de fuso. */
export function diaEMes(data: Date) {
  return `${String(data.getDate()).padStart(2, "0")}/${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}`;
}

const mesPorExtenso = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

/** "11 a 17 de agosto de 2026" — título da semana visível. */
export function intervaloDaSemana(domingo: Date) {
  const sabado = somarDias(domingo, 6);
  const mesmoMes = domingo.getMonth() === sabado.getMonth();

  if (mesmoMes) {
    return `${domingo.getDate()} a ${sabado.getDate()} de ${mesPorExtenso.format(domingo)}`;
  }

  return `${diaEMes(domingo)} a ${diaEMes(sabado)} de ${sabado.getFullYear()}`;
}

const dataPorExtenso = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function dataCompleta(data: Date) {
  return dataPorExtenso.format(data);
}
