import {
  ETAPA_SEM_LEAD,
  passouDoContato,
  type EtapaFunil,
  type Lead,
} from "@/data/leads";
import type { Clinica } from "@/data/clinicas";
import {
  indexarPorLead,
  mudancasDoLead,
  type MudancaDeEtapa,
} from "@/data/historicoEtapas";
import type { Metas } from "@/data/metas";
import type { Agendamento } from "@/data/agendamentos";
import { primeiraTentativa, type Ligacoes } from "@/data/ligacoes";
import { dentroDaFaixa, taxa, type Alerta, type Faixa } from "@/lib/relatorios";

/**
 * O histórico pode chegar como lista ou já agrupado por lead. Medir a base
 * inteira lead a lead numa lista de catorze mil linhas seria varrer tudo três
 * mil vezes; quem faz conta em massa passa o índice.
 */
export type HistoricoDeEtapas =
  MudancaDeEtapa[] | Map<number, MudancaDeEtapa[]>;

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

/**
 * O autor que a varredura de correção grava em `lead_etapa_eventos.autor_nome`.
 *
 * Evento com esse autor foi escrito depois do fato: ele carrega a hora em que a
 * correção rodou, e não a hora em que o atendimento aconteceu. Medido em
 * 18/11/2026, na clínica 39, eram 52 de 215 leads, e eles sozinhos levavam a
 * mediana de 14 para 34 minutos, a média de 2h36 para 8h57 e a cauda de 10%
 * para 22% — dois terços da cauda era correção, não demora.
 *
 * Por isso a espera desses leads fica **não medida**, e não zero nem o valor
 * inflado: o lead continua contado como contatado (ver `montarFila`), ele só
 * não entra em média, mediana, faixa de espera nem alerta de cauda.
 */
export const AUTOR_DA_CORRECAO_RETROATIVA = "Correção manual";

/** Se a mudança de etapa foi escrita por varredura de correção, e não no ato. */
export function ehCorrecaoRetroativa(mudanca: MudancaDeEtapa): boolean {
  return (
    mudanca.agente.tipo === "Humano" &&
    mudanca.agente.nome === AUTOR_DA_CORRECAO_RETROATIVA
  );
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
 *
 * **É a definição de tempo de resposta do sistema desde 17/11/2026.** Mede a
 * chegada do lead até a entrada dele em "Em Contato", que é o que o banco
 * registra de fato, nos `lead_etapa_eventos`.
 *
 * Limite conhecido, assumido: depende de alguém mover o card, e quem é
 * atendido direto por telefone pode pular para `Agendamento` sem passar por
 * "Em Contato" — esse lead entra na conta como ainda não contatado. Enquanto
 * não houver registro de ligação, essa é a medida honesta disponível, e um
 * número com esse limite declarado vale mais do que "não medido" para sempre.
 *
 * Segundo limite, também assumido: contato gravado por varredura de correção
 * fica fora da conta — ver `AUTOR_DA_CORRECAO_RETROATIVA`.
 */
export function minutosAteOPrimeiroContato(
  historico: HistoricoDeEtapas,
  leadId: number,
): number | null {
  const chegada = chegadaDoLead(historico, leadId);
  const contato = primeiroContato(historico, leadId);
  if (!chegada || !contato) return null;
  if (ehCorrecaoRetroativa(contato)) return null;
  return chegada.minutosAtras - contato.minutosAtras;
}

/**
 * Quanto o lead esperou até o CRC pegar o telefone.
 *
 * **Não está em uso, e é de propósito.** Esta era a definição oficial de tempo
 * de resposta até 17/11/2026, e ela media um dado que o sistema não grava: não
 * existe registro de ligação no banco, nem tabela, nem canal, nem tentativa.
 * Com isso mediana, média, cauda e dois alertas da Fila de Atendimento ficavam
 * permanentemente em "não medido" — a tela que deveria cobrar o tempo de
 * atendimento não cobrava nada. O tempo de resposta voltou a ser
 * `minutosAteOPrimeiroContato`, que mede o que existe.
 *
 * A função fica aqui, guardada, porque a definição continua certa para o dia
 * em que a operação registrar ligação: aí é só voltar a ligar os dois pontos.
 * O limite conhecido dela: quem é atendido por telefone pode ir direto para
 * `Agendamento` sem passar por "Em Contato" — ver o limite espelhado em
 * `minutosAteOPrimeiroContato`.
 *
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
 * O primeiro corte é a promessa do atendimento: primeiro contato em até 10
 * minutos. Era 5 minutos, da régua de ligação antiga; virou 10 em 17/11/2026,
 * que é o prazo combinado com a clínica e o mesmo valor de
 * `clinicas.atendimento_delay_minutos`.
 */
/**
 * Como cada faixa é lida pela operação, decidido por ele em 18/11/2026.
 *
 * Mora aqui, junto do corte em minutos, e não na tela: a cor é a leitura da
 * faixa, e faixa e leitura separadas em arquivos diferentes foi exatamente o
 * problema que apareceu na revisão — a barra pintava "12h a 1 dia" de verde
 * enquanto o alerta de cauda contava aquele mesmo lead como demora.
 *
 * `ruim` começa onde `estaNaCauda` começa, e não é coincidência: é a mesma
 * régua, lida do mesmo lugar.
 */
export type GravidadeDaFaixa = "boa" | "atencao" | "ruim";

export type FaixaDeResposta = {
  id: string;
  rotulo: string;
  /** Limite superior em minutos, incluído. */
  ate: number;
  gravidade: GravidadeDaFaixa;
};

export const faixasDeResposta: FaixaDeResposta[] = [
  { id: "ate10", rotulo: "até 10 min", ate: 10, gravidade: "boa" },
  { id: "ate30", rotulo: "10 a 30 min", ate: 30, gravidade: "boa" },
  { id: "ate2h", rotulo: "30 min a 2h", ate: 120, gravidade: "atencao" },
  { id: "ate12h", rotulo: "2h a 12h", ate: 720, gravidade: "atencao" },
  { id: "ate1dia", rotulo: "12h a 1 dia", ate: 1440, gravidade: "ruim" },
  { id: "acima", rotulo: "mais de 1 dia", ate: Infinity, gravidade: "ruim" },
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
  /**
   * Quantos contatos de "Outros Contatos" chegaram no período e ficaram fora
   * de `recebidos`. Fica guardado para a tela poder dizer o número, em vez de
   * a conta simplesmente não fechar com a aba de Funil.
   */
  foraDaConta: number;
  /**
   * Quem já foi atendido: tem o evento de entrada em "Em Contato" **ou** já
   * está numa etapa depois do contato. Não é o mesmo que `resposta.atendidos`,
   * que é só quem tem espera medida — ver `montarFila`.
   */
  contatados: number;
  taxaDeContato: number | null;
  resposta: TempoDeResposta;
  /** Quantos leads da clínica esperaram mais de 12h — o corte de `estaNaCauda`. */
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
  agendamentos: Agendamento[];
  faixa: Faixa;
  clinicas: Clinica[];
};

/**
 * Uma linha por clínica, sempre sobre o mesmo grupo: os leads que chegaram no
 * período, de qualquer origem. Recebidos, contatados e agendados são degraus do
 * mesmo funil, e não três recortes diferentes que não fecham entre si.
 *
 * Até 17/11/2026 a aba filtrava `ehLeadDeMarketing`, e como a base inteira
 * nasce com `origem = 'WhatsApp'` ela ficava zerada para todas as clínicas.
 *
 * Volume (recebidos, contatados, agendados) e tempo de resposta (mediana,
 * média, cauda) saem da mesma base. Antes o tempo vinha da primeira tentativa
 * de ligação, que o banco não registra, e por isso vinha sempre vazio.
 *
 * Duas correções de 17/11/2026, e as duas pelo mesmo motivo — a tela dizia "16
 * leads ainda sem contato" com o cartão ao lado dizendo "0 aguardando contato":
 *
 * 1. **Contatado não é mais só quem tem o evento de "Em Contato".** Quem já
 *    está numa etapa depois do contato também conta: a equipe atende por
 *    telefone e puxa o card direto para Agendamento, sem passar pelo card do
 *    meio. Eram 10 leads assim, três deles já com consulta comparecida,
 *    contados como gente que ninguém tinha atendido.
 *
 *    O tempo de espera desses 10 continua **não medido**, e não zero: zero
 *    entraria na faixa "até 10 min" e seria lido como atendimento imediato.
 *    Por isso `contatados` (volume) e `resposta.atendidos` (quem tem espera
 *    medida) são dois números diferentes de propósito.
 *
 * 2. **"Outros Contatos" sai de `recebidos`.** É a etapa de quem não é
 *    paciente, o mesmo corte já aplicado na taxa de agendamento. Eram 6
 *    contatos entrando como lead que ninguém atendeu, sem nunca haver alguém
 *    para atender. O número deles fica em `foraDaConta`.
 */
export function montarFila({
  leads,
  historico,
  agendamentos,
  faixa,
  clinicas,
}: EntradaDaFila): LinhaFila[] {
  const indice =
    historico instanceof Map ? historico : indexarPorLead(historico);
  const comConsulta = new Set(
    agendamentos.filter((a) => a.status !== "Cancelada").map((a) => a.leadId),
  );

  return clinicas.map((clinica) => {
    const chegaram = leads.filter(
      (l) =>
        l.clinicaId === clinica.id && dentroDaFaixa(l.diasAtras, faixa),
    );
    const daClinica = chegaram.filter((l) => l.etapa !== ETAPA_SEM_LEAD);

    // `null` em `tempoDeResposta` é quem não tem espera medida — e isso inclui
    // quem foi atendido por telefone sem passar pelo card "Em Contato". Por
    // isso a conta de volume é separada, logo abaixo.
    const medidos = daClinica.map((l) =>
      minutosAteOPrimeiroContato(indice, l.id),
    );
    const resposta = tempoDeResposta(medidos);
    // Volume lê o evento de contato, e não a espera medida: quem foi contatado
    // por varredura de correção tem espera não medida de propósito, mas foi
    // atendido de verdade e continua contado aqui.
    const contatados = daClinica.filter(
      (l) => primeiroContato(indice, l.id) !== null || passouDoContato(l.etapa),
    ).length;

    const tempos = medidos.filter((t): t is number => t !== null);
    const naCauda = tempos.filter(estaNaCauda).length;

    return {
      clinica,
      recebidos: daClinica.length,
      foraDaConta: chegaram.length - daClinica.length,
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
  /** A soma de `foraDaConta` das clínicas visíveis. */
  foraDaConta: number;
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
 * O total da tela: volume somado das clínicas visíveis, e o tempo de resposta
 * refeito sobre todos os leads juntos — porque mediana de medianas não é
 * mediana.
 */
export function montarResumoDaFila(
  linhas: LinhaFila[],
  leads: Lead[],
  historico: HistoricoDeEtapas,
  faixa: Faixa,
): ResumoDaFila {
  const indice =
    historico instanceof Map ? historico : indexarPorLead(historico);

  // O mesmo recorte de `montarFila`, "Outros Contatos" fora: a mediana da tela
  // tem de sair da mesma base das linhas.
  const doPeriodo = leads.filter(
    (l) => dentroDaFaixa(l.diasAtras, faixa) && l.etapa !== ETAPA_SEM_LEAD,
  );
  const soma = (campo: (l: LinhaFila) => number) =>
    linhas.reduce((total, l) => total + campo(l), 0);

  // A mediana do conjunto não sai da média das medianas de cada clínica: só
  // refazendo a conta sobre todos os tempos juntos.
  const idsVisiveis = new Set(linhas.map((l) => l.clinica.id));
  const medidos = doPeriodo
    .filter((l) => idsVisiveis.has(l.clinicaId))
    .map((l) => minutosAteOPrimeiroContato(indice, l.id));

  const resposta = tempoDeResposta(medidos);
  const tempos = medidos.filter((t): t is number => t !== null);
  const naCauda = tempos.filter(estaNaCauda).length;

  return {
    recebidos: soma((l) => l.recebidos),
    foraDaConta: soma((l) => l.foraDaConta),
    contatados: soma((l) => l.contatados),
    taxaDeContato: taxa(
      soma((l) => l.contatados),
      soma((l) => l.recebidos),
    ),
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
      // própria cauda, senão um único lead perdido vira alarme. O piso é sobre
      // quem tem espera medida, que é a base da cauda — e não sobre
      // `contatados`, que inclui quem foi atendido sem o card e não entra nela.
      if (linha.resposta.atendidos < metas.amostraMinima) continue;
      if (linha.naCauda < metas.minimoNaCauda) continue;

      const vezes = cauda / caudaDaBase;
      if (vezes < metas.multiplicadorDaCauda) continue;

      alertas.push({
        id: `cauda-${linha.clinica.id}`,
        clinica: linha.clinica.nome,
        severidade: vezes >= metas.caudaCritica ? "critico" : "atencao",
        problema: `${cauda}% dos leads esperaram 12h ou mais pelo primeiro contato (${linha.naCauda} de ${linha.resposta.atendidos} com espera medida) — ${vezes.toFixed(1).replace(".", ",")} vezes a fatia da base, que é de ${caudaDaBase}%.`,
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
