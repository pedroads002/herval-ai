// A importação de `Consulta` é só de tipo, e desaparece na compilação: sem isso
// este arquivo — que roda no navegador — arrastaria o cliente de servidor do
// Supabase para dentro do pacote da página.
import type { Consulta } from "@/lib/dados/agenda";
import type { EtapaFunil } from "@/data/leads";

/**
 * Etapas do Funil que aparecem na Agenda. A Agenda não tem lista própria de
 * quem pode ser marcado: ela mostra os leads que já estão nessas etapas.
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

export const nomesCurtosDosDias = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
];

export type RotuloDaConsulta =
  "Agendado" | "Confirmado" | "Compareceu" | "Faltou" | "Cancelada";

/**
 * O que a etiqueta do cartão diz. São cinco rótulos para quatro status porque
 * "Confirmado" não é um desfecho: é a consulta ainda aberta que o paciente
 * respondeu confirmando presença.
 */
export function rotuloDaConsulta(consulta: Consulta): RotuloDaConsulta {
  if (consulta.status === "Compareceu") return "Compareceu";
  if (consulta.status === "Faltou") return "Faltou";
  if (consulta.status === "Cancelada") return "Cancelada";
  return consulta.confirmada ? "Confirmado" : "Agendado";
}

/**
 * Verdadeiro quando a hora da grade cai dentro do horário que a pessoa atende
 * naquela unidade. Horário em branco no cadastro devolve verdadeiro para tudo:
 * quem não informou horário não tem hora proibida — combina no WhatsApp.
 */
export function horaDentroDoHorario(
  hora: string,
  inicio: string | null,
  fim: string | null,
) {
  if (inicio === null || fim === null) return true;
  return hora >= inicio && hora < fim;
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
 * "2026-09-30" vira uma data no fuso de quem está olhando.
 *
 * Montada campo por campo de propósito: `new Date("2026-09-30")` é lido como
 * meia-noite em UTC, e no Brasil isso volta três horas — a consulta apareceria
 * na grade um dia antes do que está gravado.
 */
export function dataDoDia(dia: string) {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, diaDoMes ?? 1);
}

/** O contrário: a data da grade vira o "AAAA-MM-DD" que o banco guarda. */
export function textoDoDia(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
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
