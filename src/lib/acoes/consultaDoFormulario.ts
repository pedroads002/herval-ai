/**
 * A leitura do formulário da Agenda: o que veio da tela virando os campos da
 * tabela, ou um motivo em português para recusar.
 *
 * Mora fora do arquivo `"use server"` das ações por dois motivos. O primeiro é
 * regra do Next: um arquivo `"use server"` só pode exportar função assíncrona, e
 * toda exportação dele vira um endereço chamável de fora. O segundo é teste:
 * aqui não há sessão nem banco no caminho, então cada recusa pode ser conferida
 * uma por uma, sem precisar estar logado.
 */

const LIMITE_OBSERVACAO = 500;

/**
 * Até onde uma data pode ir.
 *
 * Não é sobre o que é razoável marcar, é sobre dígito errado: quem digita 2062
 * em vez de 2026 põe uma consulta quarenta anos à frente, e ela fica lá, fora de
 * qualquer semana que alguém vá abrir para conferir. Para trás o limite é mais
 * curto porque registrar consulta antiga é exceção, e um ano cobre a exceção.
 */
const DIAS_PARA_TRAS = 365;
const DIAS_PARA_FRENTE = 730;

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Os campos como a tabela `agendamentos` os espera. */
export type ConsultaGravavel = {
  lead_id: number;
  unidade_id: number;
  profissional_id: number | null;
  especialidade_id: number | null;
  data_consulta: string;
  hora_consulta: string | null;
  observacao: string | null;
};

export function numeroDoCampo(formData: FormData, campo: string) {
  const n = Number(String(formData.get(campo) ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function textoDoCampo(formData: FormData, campo: string) {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

export function lerConsulta(
  formData: FormData,
): { erro: string } | ConsultaGravavel {
  const leadId = numeroDoCampo(formData, "lead");
  const unidadeId = numeroDoCampo(formData, "unidade");

  if (leadId === null) {
    return { erro: "Escolha o lead que vai ocupar o horário." };
  }
  if (unidadeId === null) {
    return { erro: "Escolha a unidade onde o paciente vai ser atendido." };
  }

  const dia = textoDoCampo(formData, "dia");
  if (dia === null || !DIA.test(dia)) {
    return { erro: "Escolha o dia da consulta." };
  }

  const quantosDias = diasDeDiferenca(dia);
  if (quantosDias === null) {
    return { erro: "Esse dia não existe no calendário." };
  }
  if (quantosDias > DIAS_PARA_FRENTE) {
    return { erro: "Essa data está longe demais. Confira o ano." };
  }
  if (quantosDias < -DIAS_PARA_TRAS) {
    return { erro: "Essa data está no passado distante. Confira o ano." };
  }

  const hora = textoDoCampo(formData, "hora");
  if (hora !== null && !HORA.test(hora)) {
    return { erro: "A hora está fora do formato 00:00." };
  }

  const observacao = textoDoCampo(formData, "observacao");
  if (observacao !== null && observacao.length > LIMITE_OBSERVACAO) {
    return {
      erro: `A observação passou de ${LIMITE_OBSERVACAO} caracteres. Resuma o recado.`,
    };
  }

  return {
    lead_id: leadId,
    unidade_id: unidadeId,
    profissional_id: numeroDoCampo(formData, "profissional"),
    especialidade_id: numeroDoCampo(formData, "procedimento"),
    data_consulta: dia,
    hora_consulta: hora,
    observacao,
  };
}

/** Quantos dias a data está à frente de hoje. Negativo é passado. */
export function diasDeDiferenca(dia: string) {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number);
  const data = new Date(ano, mes - 1, diaDoMes);

  // Data montada campo por campo devolve 31/02 como 03/03 em silêncio. Se o que
  // voltou não é o que entrou, o dia não existe.
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== diaDoMes
  ) {
    return null;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((data.getTime() - hoje.getTime()) / 86400000);
}
