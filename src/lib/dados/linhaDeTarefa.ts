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
import type {
  Responsavel,
  StatusTarefa,
  Tarefa,
  TipoTarefa,
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
};

export type ContextoDasTarefas = {
  /** Contra o que o prazo e a idade da tarefa são contados. */
  agora: Date;
  /** A linha do lead dono da tarefa, por id. */
  leads: Map<number, LinhaDeLead>;
  /** Nome do cliente da agência por id, já lido de `clinicas`. */
  clientes: Map<number, string>;
};

const tiposDeTarefa: TipoTarefa[] = ["acao-ia", "alerta-humano"];

const statusDeTarefa: StatusTarefa[] = [
  "Pendente",
  "Aprovado",
  "Rejeitado",
  "Avisado",
];

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

  const minutosDeVida = minutosDesde(linha.criado_em, contexto.agora);

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
    acao: (linha.acao_sugerida ?? "").trim() || SEM_ACAO_SUGERIDA,
    tipo,
    responsavel: responsavelDoTipo(tipo),
    status,
    // "Sem nenhuma ação" é tempo de tarefa pendente. Tarefa já decidida não
    // está parada esperando ninguém, então não entra no alerta do card.
    minutosSemAcao: status === "Pendente" ? minutosDeVida : 0,
    prazoEmHoras: (linha.prazo_em_minutos - minutosDeVida) / 60,
  };
}

/**
 * Quem executa sai do tipo, e não de uma coluna própria: alerta humano é, por
 * definição, trabalho que a IA nunca faz. Coluna separada seria um segundo
 * lugar onde a mesma verdade poderia passar a discordar de si mesma.
 */
function responsavelDoTipo(tipo: TipoTarefa): Responsavel {
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
