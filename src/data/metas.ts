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
  /** Quantos alertas aparecem antes do "ver mais". */
  alertasVisiveis: number;
  /** Volume mínimo para o percentual ser considerado confiável. */
  amostraMinima: number;
};

export const metasPadrao: Metas = {
  taxaAgendamento: 25,
  tetoCancelamento: 15,
  pisoShowRate: 70,
  showRateCritico: 55,
  cancelamentoCritico: 25,
  alertasVisiveis: 6,
  amostraMinima: 5,
};
