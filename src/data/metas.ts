/**
 * Parâmetros que definem quando um número vira alerta em "Pontos de atenção".
 *
 * Ficam aqui, e não espalhados no meio do cálculo, porque são combinados
 * comercialmente com cada cliente e mudam com o tempo. Quando existir tela de
 * configuração, é este objeto que ela vai editar.
 */
export type Metas = {
  /** Meta de agendamento sobre qualificados, em %. Abaixo disso, alerta. */
  taxaAgendamento: number;
  /** Cancelamento da produção acima deste %, alerta. */
  tetoCancelamento: number;
  /** Show-rate abaixo deste %, alerta. */
  pisoShowRate: number;
  /** Show-rate abaixo deste %, alerta crítico (vermelho). */
  showRateCritico: number;
  /** Cancelamento acima deste %, alerta crítico (vermelho). */
  cancelamentoCritico: number;
  /**
   * Quantas vezes a cauda de espera da clínica precisa ser maior que a da base
   * para virar alerta. A comparação é relativa de propósito: se o mês inteiro
   * foi ruim, isso é assunto de meta, não de uma clínica específica.
   */
  multiplicadorDaCauda: number;
  /** Acima deste múltiplo, o alerta da cauda é crítico. */
  caudaCritica: number;
  /**
   * Mínimo de leads na cauda para o alerta existir. Percentual de evento raro
   * dispara com um caso só — um lead perdido não é padrão de atendimento.
   */
  minimoNaCauda: number;
  /** Quantos alertas aparecem antes do "ver mais". */
  alertasVisiveis: number;
  /** Volume mínimo para o percentual ser considerado confiável. */
  amostraMinima: number;

  /**
   * A régua de ligação, na chegada do lead: uma rajada pelo discador, uma por
   * chamada de WhatsApp, e uma tentativa de recuperação algumas horas depois.
   *
   * Está aqui, e não dentro do cálculo, pelo mesmo motivo do resto: é combinado
   * com cada cliente. Uma clínica pode decidir que liga duas vezes, não três.
   */
  tentativasNoDiscador: number;
  tentativasNoWhatsapp: number;
  /** Minutos entre a primeira tentativa e a de recuperação. */
  esperaDaRecuperacao: number;
};

export const metasPadrao: Metas = {
  taxaAgendamento: 25,
  tetoCancelamento: 15,
  pisoShowRate: 70,
  showRateCritico: 55,
  cancelamentoCritico: 25,
  multiplicadorDaCauda: 2,
  caudaCritica: 3,
  minimoNaCauda: 3,
  alertasVisiveis: 6,
  amostraMinima: 5,
  tentativasNoDiscador: 3,
  tentativasNoWhatsapp: 2,
  esperaDaRecuperacao: 8 * 60,
};
