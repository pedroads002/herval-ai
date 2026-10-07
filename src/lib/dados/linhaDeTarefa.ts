/**
 * A conversão de uma linha de `tarefas` na tarefa que a Fila desenha.
 *
 * Mora fora de `dados/tarefas.ts` pelo mesmo motivo de `linhaDoFunil.ts`: aqui
 * não há sessão nem banco no caminho, então cada regra pode ser conferida uma
 * por uma. Um arquivo de leitura do servidor também não poderia exportar os
 * tipos e a função síncrona que estão aqui.
 *
 * A tarefa não é uma linha só: `Tarefa` é um `Lead` com os campos de operação
 * por cima, então a conversão precisa da linha de `tarefas` **e** da linha do
 * lead dono dela. Lead que não existe mais deixa a tarefa de fora, porque
 * tarefa sem lead não tem nome, telefone nem etapa — não há o que mostrar.
 */

import {
  etapasFunil,
  motivosDePerda,
  origensContato,
  type EtapaFunil,
  type MotivoPerda,
  type OrigemContato,
} from "@/data/leads";
import {
  atribuicoesDeTarefa,
  type AtribuicaoTarefa,
  type Responsavel,
  type StatusTarefa,
  type Tarefa,
  type TipoTarefa,
} from "@/data/tarefas";
import { diasDesde, type LinhaDeLead } from "@/lib/dados/linhaDoFunil";

/** A linha de `tarefas` como o PostgREST devolve: tudo texto, tudo anulável. */
export type LinhaDeTarefa = {
  id: number;
  lead_id: number;
  tipo: string;
  regra: string;
  acao_sugerida: string | null;
  status: string;
  prazo_em_minutos: number;
  criado_em: string;
  decidido_em: string | null;
  /** Só na tarefa criada à mão. Ver `supabase/criar-tarefa-a-mao.sql`. */
  prazo_em?: string | null;
  descricao?: string | null;
  atribuido_a?: string | null;
  criado_por?: string | null;
  /** Só quando a Helô devolveu. Ver `supabase/helo-executa-tarefa.sql`. */
  motivo_devolucao?: string | null;
};

export type ContextoDasTarefas = {
  /** Contra o que o prazo e a idade da tarefa são contados. */
  agora: Date;
  /** A linha do lead dono da tarefa, por id. */
  leads: Map<number, LinhaDeLead>;
  /** Nome do cliente da agência por id, já lido de `clinicas`. */
  clientes: Map<number, string>;
};

const tiposDeTarefa: TipoTarefa[] = ["acao-ia", "alerta-humano", "manual"];

const statusDeTarefa: StatusTarefa[] = [
  "Pendente",
  "Aprovado",
  "Rejeitado",
  "Avisado",
  "Concluída",
];

/**
 * A `regra` de toda tarefa criada à mão.
 *
 * A coluna é NOT NULL e guarda "qual sinal disparou a tarefa", no mesmo
 * vocabulário que o n8n grava em `mensagens.regra`. Tarefa à mão não tem sinal:
 * o que a disparou foi uma pessoa, e é isso que fica escrito. O motivo dela
 * mora em `descricao`.
 */
export const REGRA_MANUAL = "Tarefa criada à mão";

/** Teto do texto do motivo. O mesmo limite vale na tela e aqui. */
export const LIMITE_DA_DESCRICAO = 500;

/**
 * Texto da coluna "Ação sugerida" quando o banco não tem nenhuma.
 *
 * É o caso de "a clínica não tem instância de WhatsApp": aviso de
 * infraestrutura, sem abordagem redigida. Dizer que não há é uma afirmação
 * sobre o registro; preencher com um texto neutro faria a tela parecer estar
 * recomendando algo que ninguém escreveu.
 */
export const SEM_ACAO_SUGERIDA = "Sem ação sugerida";

/**
 * Devolve a tarefa pronta para a tela, ou `null` quando ela não pode ser
 * desenhada com honestidade: lead apagado, etapa que o funil não tem, tipo ou
 * status fora da lista. Nulo não é erro — quem chama transforma isso em aviso,
 * porque tarefa que desaparece da fila sem explicação é o pior dos dois casos.
 */
export function montarTarefa(
  linha: LinhaDeTarefa,
  contexto: ContextoDasTarefas,
): Tarefa | null {
  const lead = contexto.leads.get(linha.lead_id);
  if (lead === undefined) return null;

  const etapa = etapasFunil.find((nome) => nome === lead.etapa);
  if (etapa === undefined) return null;

  const tipo = tiposDeTarefa.find((nome) => nome === linha.tipo);
  if (tipo === undefined) return null;

  const status = statusDeTarefa.find((nome) => nome === linha.status);
  if (status === undefined) return null;

  // Origem fora da lista vira "WhatsApp", pelo mesmo motivo de
  // `relatorios/doBanco.ts`: é o que ela significa no banco, canal técnico de
  // entrada, e não faz nenhum lead sem campanha entrar no funil de marketing.
  const origemCrua = (lead.origem ?? "").trim();
  const origem: OrigemContato =
    origensContato.find((nome) => nome === origemCrua) ?? "WhatsApp";

  const motivo = motivosDePerda.find((nome) => nome === lead.motivo_perda);

  // Tarefa à mão sem atribuição válida não pode ser desenhada: a tela afirmaria
  // de quem é o trabalho sem ninguém ter escolhido. O CHECK do banco impede que
  // essa linha exista, e aqui ela fica de fora em vez de virar "Humano".
  const atribuidoA = atribuicoesDeTarefa.find(
    (nome) => nome === (linha.atribuido_a ?? "").trim(),
  );
  if (tipo === "manual" && atribuidoA === undefined) return null;

  const minutosDeVida = minutosDesde(linha.criado_em, contexto.agora);
  const prazoEm = instanteDoPrazo(linha, minutosDeVida, contexto.agora);
  const descricao = (linha.descricao ?? "").trim();
  const criadoPor = (linha.criado_por ?? "").trim();
  const motivoDevolucao = (linha.motivo_devolucao ?? "").trim();

  return {
    id: linha.id,
    clinicaId: lead.clinica_id ?? 0,
    cliente:
      lead.clinica_id === null
        ? null
        : (contexto.clientes.get(lead.clinica_id) ?? null),
    etapa: etapa as EtapaFunil,
    origem,
    diasAtras: diasDesde(lead.criado_em, contexto.agora),
    ...(motivo === undefined ? {} : { motivoPerda: motivo as MotivoPerda }),
    lead: (lead.nome ?? "").trim() || "Lead sem nome",
    telefone: (lead.telefone ?? "").trim() || "Sem telefone",
    regra: linha.regra,
    // Na tarefa à mão, o que fazer é o motivo que a pessoa escreveu: ele ocupa
    // a mesma coluna da tela, em vez de um segundo campo com o mesmo texto.
    acao:
      (tipo === "manual" ? descricao : (linha.acao_sugerida ?? "").trim()) ||
      SEM_ACAO_SUGERIDA,
    tipo,
    responsavel: responsavelDaTarefa(tipo, atribuidoA),
    status,
    ...(atribuidoA === undefined ? {} : { atribuidoA }),
    ...(criadoPor === "" ? {} : { criadoPor }),
    // A tarefa que a Helô devolveu continua Pendente e já está como "CRC": sem
    // este texto na tela, ela teria trocado de dono em silêncio.
    ...(motivoDevolucao === "" ? {} : { motivoDevolucao }),
    // "Sem nenhuma ação" é tempo de tarefa pendente. Tarefa já decidida não
    // está parada esperando ninguém, então não entra no alerta do card.
    minutosSemAcao: status === "Pendente" ? minutosDeVida : 0,
    prazoEm: prazoEm.toISOString(),
    prazoEmHoras: (prazoEm.getTime() - contexto.agora.getTime()) / 3_600_000,
  };
}

/**
 * O prazo como instante, venha ele da data marcada ou da contagem em minutos.
 *
 * As duas formas existem porque respondem a coisas diferentes no banco — ver
 * `supabase/criar-tarefa-a-mao.sql`. Na tela são a mesma pergunta, "para quando
 * é isto", e por isso a diferença morre aqui.
 *
 * Data inválida cai na contagem em minutos: é o caminho que toda tarefa tem,
 * porque `prazo_em_minutos` é NOT NULL com default.
 */
function instanteDoPrazo(
  linha: LinhaDeTarefa,
  minutosDeVida: number,
  agora: Date,
) {
  const marcado = linha.prazo_em ?? null;
  if (marcado !== null) {
    const quando = new Date(marcado);
    if (!Number.isNaN(quando.getTime())) return quando;
  }

  const faltam = linha.prazo_em_minutos - minutosDeVida;
  return new Date(agora.getTime() + faltam * 60_000);
}

/**
 * Quem executa sai do tipo nas tarefas automáticas, e não de uma coluna
 * própria: alerta humano é, por definição, trabalho que a IA nunca faz. Coluna
 * separada ali seria um segundo lugar onde a mesma verdade poderia passar a
 * discordar de si mesma.
 *
 * Na tarefa à mão é o contrário: a mesma tarefa pode ser do CRC ou da Helô, e
 * só quem criou sabe. Aí a resposta vem da coluna.
 */
function responsavelDaTarefa(
  tipo: TipoTarefa,
  atribuidoA: AtribuicaoTarefa | undefined,
): Responsavel {
  if (tipo === "manual") return atribuidoA === "IA" ? "IA" : "Humano";
  return tipo === "alerta-humano" ? "Humano" : "IA";
}

/** Minutos inteiros desde um instante do banco. Nunca negativo. */
export function minutosDesde(criadoEm: string, agora: Date): number {
  const inicio = new Date(criadoEm);
  if (Number.isNaN(inicio.getTime())) return 0;

  const minutos = Math.floor((agora.getTime() - inicio.getTime()) / 60_000);
  return minutos < 0 ? 0 : minutos;
}

/**
 * Confere a decisão que a tela mandou gravar, antes de qualquer gravação.
 *
 * Uma ação de servidor é um endereço POST como outro qualquer: o CHECK da
 * coluna já fecha a lista no banco, e a recusa aqui é o que dá uma frase em
 * português em vez de um erro de constraint na cara de quem clicou.
 */
export function conferirDecisao(
  tarefaId: number,
  status: string,
): { erro: string } | { status: StatusTarefa } {
  if (!Number.isInteger(tarefaId) || tarefaId <= 0) {
    return { erro: "Não deu para saber qual tarefa decidir." };
  }

  const conferido = statusDeTarefa.find((nome) => nome === status);
  if (conferido === undefined) {
    return { erro: "Essa decisão não existe na lista." };
  }

  return { status: conferido };
}

/** O que a tela manda para criar uma tarefa à mão. */
export type NovaTarefa = {
  leadId: number;
  /** O motivo, em texto livre. */
  descricao: string;
  /** "CRC" ou "IA". */
  atribuidoA: string;
  /**
   * O prazo em ISO, com fuso.
   *
   * A conversão para ISO é feita no navegador, de propósito: quem escolhe
   * "08/10 às 14:30" está pensando no relógio da mesa dele, e o servidor roda
   * em UTC. Montar o instante aqui transformaria 14:30 de Brasília em 14:30 de
   * Londres, três horas antes — prazo errado sem nenhum erro aparecer.
   */
  prazoEm: string;
};

/** A linha pronta para o insert, nos nomes das colunas do banco. */
export type LinhaNovaTarefa = {
  lead_id: number;
  tipo: "manual";
  regra: string;
  descricao: string;
  atribuido_a: AtribuicaoTarefa;
  prazo_em: string;
};

/** Limites do prazo aceito, para barrar data digitada errada. */
const ANO_MINIMO_DO_PRAZO = 2020;
const ANOS_A_FRENTE_NO_PRAZO = 5;

/**
 * Confere a tarefa que a tela quer criar, antes de qualquer gravação.
 *
 * Os CHECK da tabela já fecham a porta no banco; a recusa aqui é o que dá uma
 * frase em português em vez de um erro de constraint na cara de quem clicou —
 * o mesmo raciocínio de `conferirDecisao`.
 *
 * Prazo no passado é aceito de propósito: o CRC registra na segunda algo que
 * devia ter sido feito no sábado, e recusar isso obrigaria a mentir a data para
 * conseguir registrar. O que é recusado é data impossível — 0208 em vez de 2026
 * é erro de digitação, não registro atrasado.
 */
export function conferirNovaTarefa(
  entrada: NovaTarefa,
  agora: Date,
): { erro: string } | { linha: LinhaNovaTarefa } {
  if (!Number.isInteger(entrada.leadId) || entrada.leadId <= 0) {
    return { erro: "Escolha o lead desta tarefa." };
  }

  const descricao = (entrada.descricao ?? "").trim();
  if (descricao === "") {
    return { erro: "Escreva o motivo da tarefa." };
  }
  if (descricao.length > LIMITE_DA_DESCRICAO) {
    return {
      erro: `O motivo passou de ${LIMITE_DA_DESCRICAO} caracteres. Resuma em uma ou duas frases.`,
    };
  }

  const atribuidoA = atribuicoesDeTarefa.find(
    (nome) => nome === entrada.atribuidoA,
  );
  if (atribuidoA === undefined) {
    return { erro: "Escolha se a tarefa é do CRC ou da IA." };
  }

  const prazo = new Date(entrada.prazoEm ?? "");
  if (Number.isNaN(prazo.getTime())) {
    return { erro: "Escolha a data e a hora do prazo." };
  }

  const tetoDoPrazo = new Date(agora);
  tetoDoPrazo.setFullYear(tetoDoPrazo.getFullYear() + ANOS_A_FRENTE_NO_PRAZO);

  if (prazo.getFullYear() < ANO_MINIMO_DO_PRAZO || prazo > tetoDoPrazo) {
    return { erro: "Essa data não parece certa. Confira o ano." };
  }

  return {
    linha: {
      lead_id: entrada.leadId,
      tipo: "manual",
      regra: REGRA_MANUAL,
      descricao,
      atribuido_a: atribuidoA,
      prazo_em: prazo.toISOString(),
    },
  };
}
