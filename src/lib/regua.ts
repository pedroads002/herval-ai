import {
  ETAPA_AGENDADO,
  ETAPA_PERDIDA,
  etapasFunil,
  type EtapaFunil,
  type MotivoPerda,
} from "@/data/leads";
import type { CanalDeLigacao, Ligacao } from "@/data/ligacoes";
import type { Metas } from "@/data/metas";

/**
 * A régua de escalonamento por telefone: o que acontece com o lead conforme o
 * CRC vai registrando as tentativas de ligação.
 *
 * Duas coisas bem diferentes moram aqui, e a diferença importa:
 *
 * - `consequenciaDaLigacao` é **consequência de um ato**. Roda no instante em
 *   que alguém registra a tentativa, e é o que move o lead de etapa.
 * - `estadoDaRegua` é **estado calculado**. Não dispara nada, não agenda nada:
 *   responde "em que ponto da sequência este lead está", para a tela poder
 *   dizer que a hora da tentativa de recuperação chegou.
 *
 * O sistema nunca age sozinho no tempo. Não há job, não há relógio: o que
 * existe é uma ação humana disparando consequência, e uma conta feita na hora
 * de desenhar a tela. Quando houver telefonia de verdade, é esta segunda parte
 * que passa a ter um agendador atrás.
 */

/** A etapa de follow-up para onde o lead cai quando o telefone se esgota. */
export const ETAPA_FOLLOW_UP: EtapaFunil = "F1";

/** Onde o lead está antes de alguém falar com ele. */
export const ETAPA_INICIAL: EtapaFunil = "Leads Recebidos";

/** Para onde vai quem foi alcançado mas não fechou nada. */
export const ETAPA_CONVERSANDO: EtapaFunil = "Em Contato";

/**
 * O texto da mensagem de retomada, fixo. A Helô não se apresenta nem se
 * identifica ao mandar: é só o texto, sem "oi, aqui é a Helô".
 */
export const TEXTO_DE_RETOMADA =
  "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔";

/** Quantas tentativas a sequência inteira prevê: a rajada mais a recuperação. */
export function totalDeTentativas(metas: Metas) {
  return metas.tentativasNoDiscador + metas.tentativasNoWhatsapp + 1;
}

/** Quantas tentativas a rajada de chegada prevê, antes da janela de espera. */
export function tentativasDaRajada(metas: Metas) {
  return metas.tentativasNoDiscador + metas.tentativasNoWhatsapp;
}

/**
 * Por qual canal a régua espera a tentativa de número `tentativa`. É sugestão,
 * e não trava: se o lead pediu para ser chamado no WhatsApp na segunda
 * tentativa, foi isso que aconteceu, e recusar o registro só produziria uma
 * base que não bate com a operação.
 */
export function canalEsperado(tentativa: number, metas: Metas): CanalDeLigacao {
  return tentativa <= metas.tentativasNoDiscador ? "discador" : "whatsapp";
}

export type EstadoDaRegua =
  /** Chegou e ninguém ligou ainda. */
  | "aguardando-primeira"
  /** A rajada começou e ainda não terminou. */
  | "rajada-em-andamento"
  /** A rajada falhou; o atendimento está por mensagem, dentro do prazo. */
  | "janela-de-mensagem"
  /** Passou da espera: a tentativa de recuperação está vencida. */
  | "recuperacao-devida"
  /** Todas as tentativas falharam. */
  | "sequencia-esgotada"
  /** Alguém atendeu, ou o lead saiu do fluxo de telefone. */
  | "encerrada";

export type SituacaoDaRegua = {
  estado: EstadoDaRegua;
  /** Qual seria a próxima tentativa, e por onde. */
  proximaTentativa: number;
  canalDaProxima: CanalDeLigacao;
  /** Minutos desde a primeira tentativa. Nulo quando nunca se ligou. */
  minutosDesdeAPrimeira: number | null;
  /**
   * Há quantos minutos a tentativa de recuperação venceu. Só existe em
   * "recuperacao-devida" — nos outros estados não há atraso a mostrar.
   */
  atrasoDaRecuperacao: number | null;
};

/** Etapas em que o telefone já não é mais o assunto. */
function saiuDoFluxo(etapa: EtapaFunil) {
  return (
    etapasFunil.indexOf(etapa) >= etapasFunil.indexOf(ETAPA_AGENDADO) ||
    etapa === ETAPA_PERDIDA
  );
}

/**
 * Em que ponto da sequência o lead está. Só lê: não move ninguém.
 *
 * `minutosAtras` é um número guardado, e não um relógio correndo — então este
 * estado muda quando a tela desenha de novo, não sozinho enquanto alguém olha.
 * Com telefonia real isso vira um evento; aqui é uma conta honesta.
 */
export function situacaoDaRegua(
  ligacoes: Ligacao[],
  etapa: EtapaFunil,
  metas: Metas,
): SituacaoDaRegua {
  const feitas = ligacoes.length;
  const primeira = [...ligacoes].sort((a, b) => b.minutosAtras - a.minutosAtras)[0];
  const minutosDesdeAPrimeira = primeira ? primeira.minutosAtras : null;
  const proximaTentativa = feitas + 1;

  const base = {
    proximaTentativa,
    canalDaProxima: canalEsperado(proximaTentativa, metas),
    minutosDesdeAPrimeira,
    atrasoDaRecuperacao: null,
  };

  const atendeu = ligacoes.some((l) => l.desfecho === "atendida");
  if (atendeu || saiuDoFluxo(etapa)) {
    return { ...base, estado: "encerrada" };
  }

  if (feitas === 0) return { ...base, estado: "aguardando-primeira" };

  const rajada = tentativasDaRajada(metas);
  if (feitas < rajada) return { ...base, estado: "rajada-em-andamento" };

  if (feitas >= totalDeTentativas(metas)) {
    return { ...base, estado: "sequencia-esgotada" };
  }

  // Rajada completa e recuperação ainda não feita: o que decide é o relógio.
  const espera = minutosDesdeAPrimeira ?? 0;
  if (espera < metas.esperaDaRecuperacao) {
    return { ...base, estado: "janela-de-mensagem" };
  }

  return {
    ...base,
    estado: "recuperacao-devida",
    atrasoDaRecuperacao: espera - metas.esperaDaRecuperacao,
  };
}

/** O que o CRC apurou quando o lead atendeu. */
export type ResultadoDaConversa =
  | "converteu"
  | "nao-converteu"
  | "desqualificou";

export type RegistroDeTentativa = {
  /** Etapa em que o lead está antes desta tentativa. */
  etapa: EtapaFunil;
  /** Número desta tentativa dentro da sequência do lead. */
  tentativa: number;
  atendida: boolean;
  /** Só quando atendida. */
  resultado?: ResultadoDaConversa;
  /** Só quando o resultado é desqualificação. */
  motivoPerda?: MotivoPerda;
};

export type Consequencia = {
  /** Para onde a etapa vai. Nulo quando esta tentativa não move o lead. */
  etapa: EtapaFunil | null;
  motivoPerda?: MotivoPerda;
  /** A mensagem automática de retomada deve ser enviada. */
  retomada: boolean;
  /**
   * O formulário de agendamento deve abrir. Converter não move a etapa aqui:
   * quem marca a consulta é que move o lead para `Agendamento`, e essa regra
   * já existe. Dois caminhos para a mesma etapa produziriam lead agendado sem
   * agendamento.
   */
  abrirAgendamento: boolean;
};

const NADA: Consequencia = {
  etapa: null,
  retomada: false,
  abrirAgendamento: false,
};

/**
 * Só entra em "Em Contato" quem ainda não saiu de "Leads Recebidos". Sem esta
 * guarda, uma ligação registrada com atraso puxaria para trás um lead que já
 * avançou.
 */
function paraEmContato(etapa: EtapaFunil): EtapaFunil | null {
  return etapa === ETAPA_INICIAL ? ETAPA_CONVERSANDO : null;
}

/**
 * O que acontece com o lead depois desta tentativa. Função pura: recebe o
 * estado, devolve a decisão, e quem grava é o provedor.
 */
export function consequenciaDaLigacao(
  registro: RegistroDeTentativa,
  metas: Metas,
): Consequencia {
  if (registro.atendida) {
    if (registro.resultado === "converteu") {
      return { ...NADA, abrirAgendamento: true };
    }
    if (registro.resultado === "desqualificou") {
      return {
        ...NADA,
        etapa: ETAPA_PERDIDA,
        ...(registro.motivoPerda ? { motivoPerda: registro.motivoPerda } : {}),
      };
    }
    // Conversou e não fechou nada: o lead passa a ser um lead em conversa.
    return { ...NADA, etapa: paraEmContato(registro.etapa) };
  }

  // A rajada inteira falhou: o atendimento passa a ser por mensagem.
  if (registro.tentativa === tentativasDaRajada(metas)) {
    return { ...NADA, etapa: paraEmContato(registro.etapa) };
  }

  // A recuperação também falhou: a Helô manda a mensagem de fechamento e o
  // lead segue para o follow-up. Só cai para lá quem ainda não passou dali.
  if (registro.tentativa === totalDeTentativas(metas)) {
    const antesDoFollowUp =
      etapasFunil.indexOf(registro.etapa) < etapasFunil.indexOf(ETAPA_FOLLOW_UP);
    return {
      ...NADA,
      retomada: true,
      etapa: antesDoFollowUp ? ETAPA_FOLLOW_UP : null,
    };
  }

  return NADA;
}
