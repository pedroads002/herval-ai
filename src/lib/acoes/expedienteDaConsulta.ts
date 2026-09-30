/**
 * A conferência de expediente: o dia e a hora escolhidos cabem no horário que a
 * pessoa atende naquela unidade.
 *
 * A grade da Agenda já escurecia o que está fora do expediente, mas escurecer é
 * desenho — o formulário deixava marcar de qualquer jeito. A recusa de verdade
 * mora do lado da gravação, e é esta função que a ação chama.
 *
 * Mora fora do arquivo `"use server"` pelo mesmo motivo de
 * `consultaDoFormulario.ts`: um arquivo `"use server"` só pode exportar função
 * assíncrona, e aqui não há sessão nem banco no caminho — então cada recusa pode
 * ser conferida uma por uma, sem precisar estar logado.
 */

import type { ConsultaGravavel } from "@/lib/acoes/consultaDoFormulario";

/** O que o cadastro diz sobre o expediente da pessoa naquela unidade. */
export type ExpedienteNaUnidade = {
  /** 1 é segunda e 7 é domingo. Vazio ou nulo é "todos os dias". */
  dias_semana: number[] | null;
  /** "HH:MM" ou "HH:MM:SS". Nulo é "não informou". */
  hora_inicio: string | null;
  hora_fim: string | null;
};

/**
 * Devolve o motivo da recusa, em português, ou nulo quando o horário cabe.
 *
 * Dia ou hora em branco no cadastro não proíbem nada, que é a mesma regra da
 * tela: quem não informou horário combina no WhatsApp, e recusar tudo de quem
 * ainda não preencheu o cadastro travaria a agência inteira.
 */
export function conferirExpediente(
  expediente: ExpedienteNaUnidade,
  dados: Pick<ConsultaGravavel, "data_consulta" | "hora_consulta">,
  nomeDaUnidade: string,
): string | null {
  const dias = expediente.dias_semana ?? [];

  if (dias.length > 0 && !dias.includes(diaDaSemana(dados.data_consulta))) {
    return `Essa pessoa não atende ${nomeDoDia(dados.data_consulta)} em ${nomeDaUnidade}. Escolha outro dia ou outro profissional.`;
  }

  // Só o dia foi combinado: não há hora para conferir.
  if (dados.hora_consulta === null) return null;

  const inicio = horaCurta(expediente.hora_inicio);
  const fim = horaCurta(expediente.hora_fim);
  if (inicio === null || fim === null) return null;

  const hora = horaCurta(dados.hora_consulta);
  if (hora === null) return null;

  // Fim de fora: quem atende até as 12:00 não começa uma consulta às 12:00.
  if (hora < inicio || hora >= fim) {
    return `Essa pessoa atende das ${inicio} às ${fim} em ${nomeDaUnidade}. Escolha um horário dentro do expediente.`;
  }

  return null;
}

/**
 * "09:00:00" e "09:00" viram os mesmos cinco caracteres.
 *
 * Sem isso a comparação de texto erra o limite: "08:00" é menor que "08:00:00"
 * porque acaba antes, e marcar exatamente na hora de abrir seria recusado.
 */
function horaCurta(valor: string | null) {
  if (valor === null) return null;
  const curta = valor.slice(0, 5);
  return curta.length === 5 ? curta : null;
}

/** 1 é segunda e 7 é domingo, como `profissional_unidades` guarda. */
function diaDaSemana(dia: string) {
  const doJavascript = dataLocal(dia).getDay();
  return doJavascript === 0 ? 7 : doJavascript;
}

const NOMES_DOS_DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

function nomeDoDia(dia: string) {
  return NOMES_DOS_DIAS[dataLocal(dia).getDay()];
}

/**
 * Montada campo por campo: `new Date("2026-09-30")` é lido como meia-noite em
 * UTC, e no Brasil isso volta três horas — o dia da semana sairia errado.
 */
function dataLocal(dia: string) {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, diaDoMes ?? 1);
}
