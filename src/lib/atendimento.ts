import { ehLeadDeMarketing, type EtapaFunil, type Lead } from "@/data/leads";
import { clinicasIniciais, type Clinica } from "@/data/clinicas";
import {
  indexarPorLead,
  mudancasDoLead,
  type MudancaDeEtapa,
} from "@/data/historicoEtapas";
import type { Metas } from "@/data/metas";
import { agendamentosIniciais, type Agendamento } from "@/data/agendamentos";
import { primeiraTentativa, type Ligacoes } from "@/data/ligacoes";
import {
  dentroDaFaixa,
  taxa,
  type Alerta,
  type Faixa,
} from "@/lib/relatorios";

/**
 * O histórico pode chegar como lista ou já agrupado por lead. Medir a base
 * inteira lead a lead numa lista de catorze mil linhas seria varrer tudo três
 * mil vezes; quem faz conta em massa passa o índice.
 */
export type HistoricoDeEtapas = MudancaDeEtapa[] | Map<number, MudancaDeEtapa[]>;

function doLead(historico: HistoricoDeEtapas, leadId: number) {
  return historico instanceof Map
    ? (historico.get(leadId) ?? [])
    : mudancasDoLead(historico, leadId);
}

/**
 * Regra oficial de primeiro contato: é a entrada do lead na etapa "Em Contato".
 *
 * A alternativa era a primeira mensagem do histórico da IA, e ela foi
 * descartada de propósito. A régua do projeto diz que o primeiro contato de
 * lead novo nunca é da IA — então aquela mensagem mede a segunda ação, não a
 * primeira. Medir pela etapa cobra exatamente o que a operação promete.
 *
 * O custo é que depende de o CRC mover o card. Isso é assumido: lead com
 * ligação feita e card parado aparece como demora, em vez de sumir da conta.
 *
 * Esta é a definição única de tempo de resposta do sistema. Qualquer tela que
 * mostre esse número lê daqui, e não recalcula do seu jeito.
 */
export const ETAPA_PRIMEIRO_CONTATO: EtapaFunil = "Em Contato";

/** A chegada do lead na base: a primeira linha do histórico dele. */
export function chegadaDoLead(
  historico: HistoricoDeEtapas,
  leadId: number,
): MudancaDeEtapa | null {
  return doLead(historico, leadId)[0] ?? null;
}

/** A mudança que marcou o primeiro contato. Nulo em quem nunca foi atendido. */
export function primeiroContato(
  historico: HistoricoDeEtapas,
  leadId: number,
): MudancaDeEtapa | null {
  return (
    doLead(historico, leadId).find(
      (m) => m.etapaNova === ETAPA_PRIMEIRO_CONTATO,
    ) ?? null
  );
}

/**
 * Quantos minutos o lead esperou até alguém falar com ele. Nulo quando ainda
 * não houve contato — e nulo não é zero: quem ainda espera não pode entrar
 * numa média como se tivesse sido atendido na hora.
 */
export function minutosAteOPrimeiroContato(
  historico: HistoricoDeEtapas,
  leadId: number,
): number | null {
  const chegada = chegadaDoLead(historico, leadId);
  const contato = primeiroContato(historico, leadId);
  if (!chegada || !contato) return null;
  return chegada.minutosAtras - contato.minutosAtras;
}

/**
 * Quanto o lead esperou até o CRC pegar o telefone. **Esta é a definição
 * oficial de tempo de resposta.**
 *
 * A anterior media a entrada em "Em Contato", e quebrava com a régua de
 * ligação: quem atende a ligação vai direto para `Agendamento` ou
 * `Venda Perdida` e nunca passa por "Em Contato" — ou seja, justamente os
 * leads bem atendidos sairiam da conta, e o número passaria a medir o tempo
 * até a operação desistir do telefone.
 *
 * Só existe para quem tem ligação registrada, que hoje são os leads da fila.
 * Nunca dá negativo: nenhuma ligação acontece antes de o lead chegar, e isso
 * é invariante checada na base.
 */
export function minutosAteAPrimeiraTentativa(
  historico: HistoricoDeEtapas,
  ligacoes: Ligacoes,
  leadId: number,
): number | null {
  const chegada = chegadaDoLead(historico, leadId);
  const primeira = primeiraTentativa(ligacoes, leadId);
  if (!chegada || !primeira) return null;
  return chegada.minutosAtras - primeira.minutosAtras;
}

export type TempoDeResposta = {
  /** Média em minutos dos leads que já foram contatados. */
  media: number | null;
  /** Mediana: resiste a um caso perdido que puxaria a média sozinho. */
  mediana: number | null;
  atendidos: number;
  aguardando: number;
};

/**
 * Recebe os tempos já apurados, e não os leads: assim quem chama decide por
 * qual definição mediu, e não existe uma segunda cópia da regra aqui dentro.
 * `null` é quem ainda espera — e nulo não é zero.
 */
export function tempoDeResposta(medidos: (number | null)[]): TempoDeResposta {
  const tempos: number[] = [];
  let aguardando = 0;

  for (const minutos of medidos) {
    if (minutos === null) aguardando += 1;
    else tempos.push(minutos);
  }

  if (tempos.length === 0) {
    return { media: null, mediana: null, atendidos: 0, aguardando };
  }

  const ordenados = [...tempos].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);

  return {
    media: Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length),
    mediana:
      ordenados.length % 2 === 0
        ? Math.round((ordenados[meio - 1] + ordenados[meio]) / 2)
        : ordenados[meio],
    atendidos: tempos.length,
    aguardando,
  };
}

// --- Faixas de espera ------------------------------------------------------

/**
 * As faixas em que a espera pelo primeiro contato é lida. Elas existem aqui,
 * e não dentro de uma tela, porque tanto a distribuição quanto os alertas
 * precisam usar exatamente os mesmos cortes — dois lugares medindo "demorou"
 * com réguas diferentes é como as divergências deste projeto começaram.
 *
 * O primeiro corte é a promessa da régua de automação: ligar em até 5 minutos.
 */
export type FaixaDeResposta = {
  id: string;
  rotulo: string;
  /** Limite superior em minutos, incluído. */
  ate: number;
};

export const faixasDeResposta: FaixaDeResposta[] = [
  { id: "ate5", rotulo: "até 5 min", ate: 5 },
  { id: "ate30", rotulo: "5 a 30 min", ate: 30 },
  { id: "ate2h", rotulo: "30 min a 2h", ate: 120 },
  { id: "ate12h", rotulo: "2h a 12h", ate: 720 },
  { id: "ate1dia", rotulo: "12h a 1 dia", ate: 1440 },
  { id: "acima", rotulo: "mais de 1 dia", ate: Infinity },
];

export function faixaDaResposta(minutos: number): FaixaDeResposta {
  return faixasDeResposta.find((f) => minutos <= f.ate) ?? faixasDeResposta[0];
}

/** Espera que já passou de um dia: a faixa mais grave que existe. */
export const ESPERA_CRITICA = 1440;

/**
 * A cauda são as duas últimas faixas juntas — "12h a 1 dia" e "mais de 1 dia".
 * O corte não é número novo: é onde a antepenúltima faixa termina.
 */
export const INICIO_DA_CAUDA =
  faixasDeResposta[faixasDeResposta.length - 3].ate;

export function estaNaCauda(minutos: number) {
  return minutos > INICIO_DA_CAUDA;
}

// --- A fila por clínica ----------------------------------------------------

export type LinhaFila = {
  clinica: Clinica;
  recebidos: number;
  contatados: number;
  taxaDeContato: number | null;
  resposta: TempoDeResposta;
  /** Quantos leads da clínica esperaram 12h ou mais. */
  naCauda: number;
  percentualNaCauda: number | null;
  agendados: number;
};

/** Um lead que chegou e ainda não foi contatado por ninguém. */
export type LeadNaEspera = {
  id: number;
  clinicaId: number;
  /** Nome, quando a base tem. O histórico antigo guarda só o id. */
  nome: string | null;
  minutosDeEspera: number;
};

type EntradaDaFila = {
  /** Base inteira: é dela que saem os números de volume. */
  leads: Lead[];
  historico: HistoricoDeEtapas;
  /** Registro de ligação. Só existe para os leads da fila. */
  ligacoes: Ligacoes;
  agendamentos?: Agendamento[];
  faixa: Faixa;
  clinicas?: Clinica[];
};

/**
 * Uma linha por clínica, sempre sobre o mesmo grupo: os leads de campanha que
 * chegaram no período. Recebidos, contatados e agendados são degraus do mesmo
 * funil, e não três recortes diferentes que não fecham entre si.
 *
 * Dentro da linha convivem duas bases, de propósito:
 *
 * - **Volume** (recebidos, contatados, agendados) conta a base inteira. São os
 *   mesmos números dos Relatórios, e precisam continuar batendo com eles.
 * - **Tempo de resposta** (mediana, média, cauda) conta só quem tem ligação
 *   registrada. A definição nova mede da primeira tentativa de ligação, e esse
 *   dado não existe no histórico — misturar as duas bases num agregado só
 *   inventaria um número que não corresponde a nenhuma das duas.
 */
export function montarFila({
  leads,
  historico,
  ligacoes,
  agendamentos = agendamentosIniciais,
  faixa,
  clinicas = clinicasIniciais,
}: EntradaDaFila): LinhaFila[] {
  const indice =
    historico instanceof Map ? historico : indexarPorLead(historico);
  const comConsulta = new Set(
    agendamentos.filter((a) => a.status !== "Cancelada").map((a) => a.leadId),
  );

  return clinicas.map((clinica) => {
    const daClinica = leads.filter(
      (l) =>
        l.clinicaId === clinica.id &&
        ehLeadDeMarketing(l) &&
        dentroDaFaixa(l.diasAtras, faixa),
    );

    // Volume: quem chegou a "Em Contato" ou além, na base inteira.
    const contatados = daClinica.filter(
      (l) => minutosAteOPrimeiroContato(indice, l.id) !== null,
    ).length;

    // Tempo de resposta: só quem tem ligação registrada.
    const medidos = daClinica
      .filter((l) => primeiraTentativa(ligacoes, l.id) !== null)
      .map((l) => minutosAteAPrimeiraTentativa(indice, ligacoes, l.id));
    const resposta = tempoDeResposta(medidos);

    const tempos = medidos.filter((t): t is number => t !== null);
    const naCauda = tempos.filter(estaNaCauda).length;

    return {
      clinica,
      recebidos: daClinica.length,
      contatados,
      taxaDeContato: taxa(contatados, daClinica.length),
      resposta,
      naCauda,
      percentualNaCauda: taxa(naCauda, tempos.length),
      agendados: daClinica.filter((l) => comConsulta.has(l.id)).length,
    };
  });
}

export type ResumoDaFila = {
  recebidos: number;
  contatados: number;
  taxaDeContato: number | null;
  resposta: TempoDeResposta;
  agendados: number;
  /** Quantos dos contatados caíram em cada faixa de espera. */
  distribuicao: { faixa: FaixaDeResposta; quantidade: number }[];
  /** Percentual que esperou mais de um dia. É a cauda que puxa a média. */
  percentualNaCauda: number | null;
};

/**
 * O total da tela, com o mesmo split das linhas: volume somado das clínicas
 * visíveis, tempo de resposta refeito sobre os leads que têm ligação — porque
 * mediana de medianas não é mediana.
 */
export function montarResumoDaFila(
  linhas: LinhaFila[],
  leads: Lead[],
  historico: HistoricoDeEtapas,
  ligacoes: Ligacoes,
  faixa: Faixa,
): ResumoDaFila {
  const indice =
    historico instanceof Map ? historico : indexarPorLead(historico);

  const doPeriodo = leads.filter(
    (l) => ehLeadDeMarketing(l) && dentroDaFaixa(l.diasAtras, faixa),
  );
  const soma = (campo: (l: LinhaFila) => number) =>
    linhas.reduce((total, l) => total + campo(l), 0);

  // A mediana do conjunto não sai da média das medianas de cada clínica: só
  // refazendo a conta sobre todos os tempos juntos.
  const idsVisiveis = new Set(linhas.map((l) => l.clinica.id));
  const medidos = doPeriodo
    .filter(
      (l) =>
        idsVisiveis.has(l.clinicaId) && primeiraTentativa(ligacoes, l.id) !== null,
    )
    .map((l) => minutosAteAPrimeiraTentativa(indice, ligacoes, l.id));

  const resposta = tempoDeResposta(medidos);
  const tempos = medidos.filter((t): t is number => t !== null);
  const naCauda = tempos.filter(estaNaCauda).length;

  return {
    recebidos: soma((l) => l.recebidos),
    contatados: soma((l) => l.contatados),
    taxaDeContato: taxa(soma((l) => l.contatados), soma((l) => l.recebidos)),
    resposta,
    agendados: soma((l) => l.agendados),
    distribuicao: faixasDeResposta.map((f) => ({
      faixa: f,
      quantidade: tempos.filter((t) => faixaDaResposta(t).id === f.id).length,
    })),
    percentualNaCauda: taxa(naCauda, tempos.length),
  };
}

// --- Estado ao vivo --------------------------------------------------------

/**
 * Quem está esperando contato agora. Não depende de período: é o estado do
 * momento, e por isso a tela precisa dizer que este número não obedece ao
 * filtro, senão ele é lido como se fosse do recorte escolhido.
 */
export function aguardandoContato(
  leads: Lead[],
  historico: HistoricoDeEtapas,
  nomes?: Map<number, string>,
): LeadNaEspera[] {
  const indice =
    historico instanceof Map ? historico : indexarPorLead(historico);

  return leads
    .filter((l) => !primeiroContato(indice, l.id))
    .map((l) => ({
      id: l.id,
      clinicaId: l.clinicaId,
      nome: nomes?.get(l.id) ?? null,
      minutosDeEspera: chegadaDoLead(indice, l.id)?.minutosAtras ?? 0,
    }))
    .sort((a, b) => b.minutosDeEspera - a.minutosDeEspera);
}

// --- Pontos de atenção -----------------------------------------------------

/**
 * Dois gatilhos, nos mesmos cortes de `faixasDeResposta`:
 *
 * 1. Lead parado há mais de um dia sem ninguém falar com ele. É por lead, e
 *    não por clínica, porque a ação é sobre aquele lead específico.
 *
 * 2. Clínica com cauda desproporcional: a fatia dela nas duas últimas faixas
 *    (12h ou mais) comparada com a mesma fatia na base inteira, no mesmo
 *    período. A comparação é com a base, e não com um número fixo, porque um
 *    mês ruim para todo mundo é assunto de meta, não de uma clínica.
 *
 *    Antes este gatilho olhava a mediana da clínica, e nunca disparava: a
 *    mediana resiste a exceção por construção, e alerta existe justamente para
 *    pegar exceção. A cauda é onde a diferença entre clínicas aparece.
 */
export type RecuperacaoVencida = {
  id: number;
  clinicaId: number;
  nome: string | null;
  /** Há quantos minutos a tentativa de recuperação deveria ter acontecido. */
  atraso: number;
};

export function montarAlertasDaFila(
  linhas: LinhaFila[],
  esperando: LeadNaEspera[],
  caudaDaBase: number | null,
  metas: Metas,
  nomeDaClinica: (id: number) => string,
  recuperacoes: RecuperacaoVencida[] = [],
): Alerta[] {
  const alertas: Alerta[] = [];

  /**
   * Terceiro gatilho: a régua de ligação prevê uma tentativa de recuperação
   * algumas horas depois da rajada, e ela venceu. Não há job que dispare isso
   * — é conta feita na hora de desenhar, e por isso ela precisa aparecer em
   * algum lugar onde alguém olhe, senão a régua só existe no papel.
   */
  for (const lead of recuperacoes) {
    const horas = Math.round(lead.atraso / 60);
    alertas.push({
      id: `recuperacao-${lead.id}`,
      clinica: nomeDaClinica(lead.clinicaId),
      severidade: lead.atraso >= ESPERA_CRITICA ? "critico" : "atencao",
      problema: `${lead.nome ?? `Lead ${lead.id}`} esgotou a rajada de ligações e a tentativa de recuperação está vencida há ${horas}h.`,
      acao: "Fazer a última tentativa por WhatsApp antes de o lead cair no follow-up.",
    });
  }

  for (const lead of esperando) {
    if (lead.minutosDeEspera <= ESPERA_CRITICA) continue;
    alertas.push({
      id: `espera-${lead.id}`,
      clinica: nomeDaClinica(lead.clinicaId),
      severidade: "critico",
      problema: `${lead.nome ?? `Lead ${lead.id}`} chegou há ${Math.floor(
        lead.minutosDeEspera / 1440,
      )} dia(s) e ninguém falou com ele até agora.`,
      acao: "Fazer o primeiro contato hoje ou marcar o lead como descartado.",
    });
  }

  if (caudaDaBase !== null && caudaDaBase > 0) {
    for (const linha of linhas) {
      const cauda = linha.percentualNaCauda;
      if (cauda === null) continue;
      // Os dois pisos: volume da clínica, como nos outros alertas, e volume da
      // própria cauda, senão um único lead perdido vira alarme.
      if (linha.contatados < metas.amostraMinima) continue;
      if (linha.naCauda < metas.minimoNaCauda) continue;

      const vezes = cauda / caudaDaBase;
      if (vezes < metas.multiplicadorDaCauda) continue;

      alertas.push({
        id: `cauda-${linha.clinica.id}`,
        clinica: linha.clinica.nome,
        severidade: vezes >= metas.caudaCritica ? "critico" : "atencao",
        problema: `${cauda}% dos leads esperaram 12h ou mais pelo primeiro contato (${linha.naCauda} de ${linha.contatados}) — ${vezes.toFixed(1).replace(".", ",")} vezes a fatia da base, que é de ${caudaDaBase}%.`,
        acao: "Revisar quem recebe o lead novo nesta clínica e o horário de cobertura.",
      });
    }
  }

  const ordem = { critico: 0, atencao: 1 } as const;
  return alertas.sort(
    (a, b) =>
      ordem[a.severidade] - ordem[b.severidade] ||
      a.clinica.localeCompare(b.clinica),
  );
}

