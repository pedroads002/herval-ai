/**
 * O adaptador entre as linhas do banco e os tipos que os Relatórios já
 * calculam: `Lead`, `Agendamento` e `Clinica`.
 *
 * Por que existe um adaptador, e não um ajuste nas contas: as funções de
 * `lib/relatorios.ts` estão certas — o problema sempre foi a fonte do dado que
 * entrava nelas. Mexer na conta para caber no banco seria trocar a métrica de
 * lugar sem ninguém pedir. Aqui o banco é traduzido, e a conta continua a mesma.
 *
 * Por que puro, e fora de `dados/`: os campos de dia (`diasAtras`,
 * `criadoHaDias`, `consultaEmDias`) são relativos a hoje, e quem decide que dia
 * é hoje é a tela — é o mesmo `hoje` que monta a faixa do período. Calcular
 * isso no servidor usaria o fuso do servidor, e a partir das 21h de Brasília o
 * servidor já está no dia seguinte: o lead de hoje apareceria como de ontem e
 * sairia da faixa "Hoje". Então o servidor lê as linhas, a tela converte com o
 * relógio dela, e a lógica de fuso dos filtros fica intocada.
 */
import {
  statusAgendamento,
  type Agendamento,
  type StatusAgendamento,
} from "@/data/agendamentos";
import type { Clinica } from "@/data/clinicas";
import {
  etapasFunil,
  motivosDePerda,
  origensContato,
  type EtapaFunil,
  type Lead,
  type MotivoPerda,
  type OrigemContato,
} from "@/data/leads";

export type LinhaDeLeadDoBanco = {
  id: number;
  /** Só a Fila usa: é o nome que aparece em quem está aguardando contato. */
  nome: string | null;
  clinica_id: number | null;
  etapa: string;
  origem: string | null;
  criado_em: string;
  motivo_perda: string | null;
};

export type LinhaDeAgendamentoDoBanco = {
  id: number;
  lead_id: number;
  unidade_id: number;
  profissional_id: number | null;
  especialidade_id: number | null;
  data_consulta: string;
  hora_consulta: string | null;
  status: string;
  confirmada: boolean;
  fechado_por: string;
  observacao: string | null;
  criado_em: string;
};

export type LinhaDeClinicaDoBanco = {
  id: number;
  nome: string | null;
  ativa: boolean | null;
};

const UM_DIA = 24 * 60 * 60 * 1000;

function inicioDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

/**
 * Quantos dias atrás, na mesma fórmula que a tela usa para converter os presets
 * de período. As duas precisam concordar: é o mesmo número comparado com a
 * mesma faixa.
 */
function diasAtrasDe(data: Date, hoje: Date) {
  return Math.round((hoje.getTime() - inicioDoDia(data).getTime()) / UM_DIA);
}

/**
 * `data_consulta` é um dia no calendário, sem hora e sem fuso. Montar a data
 * pelos pedaços evita o que `new Date("2026-10-03")` faz: ler como meia-noite em
 * UTC e, no Brasil, virar o dia anterior às 21h.
 */
function diaDoCalendario(texto: string): Date | null {
  const pedacos = texto.split("-").map(Number);
  if (pedacos.length < 3 || pedacos.some((n) => !Number.isFinite(n))) {
    return null;
  }
  return new Date(pedacos[0], pedacos[1] - 1, pedacos[2]);
}

/** O que o banco trouxe e o tipo da tela não tem como representar. */
export type Desconhecidos = {
  etapas: string[];
  origens: string[];
  status: string[];
};

export type LeadsDoBanco = {
  leads: Lead[];
  desconhecidos: Pick<Desconhecidos, "etapas" | "origens">;
};

/**
 * Converte os leads do banco.
 *
 * Etapa fora do funil deixa o lead de fora da conta em vez de virar etapa
 * plausível: lead contado na coluna errada é pior que lead declarado de fora.
 *
 * Origem que não está na lista — hoje "Teste manual" — vira "WhatsApp", que é o
 * que ela significa no banco: canal técnico de entrada, não campanha. O efeito
 * em `ehLeadDeMarketing` é o mesmo de hoje (não é paga), e nenhum lead sem
 * campanha entra no funil de marketing por engano.
 */
export function montarLeadsDoBanco(
  linhas: LinhaDeLeadDoBanco[],
  hoje: Date,
): LeadsDoBanco {
  const leads: Lead[] = [];
  const etapas = new Set<string>();
  const origens = new Set<string>();

  for (const linha of linhas) {
    const etapa = etapasFunil.find((nome) => nome === linha.etapa);
    if (etapa === undefined) {
      etapas.add(linha.etapa);
      continue;
    }

    const origemCrua = (linha.origem ?? "").trim();
    const origem: OrigemContato =
      origensContato.find((nome) => nome === origemCrua) ?? "WhatsApp";
    if (origemCrua !== "" && origem !== origemCrua) origens.add(origemCrua);

    const motivo = motivosDePerda.find((nome) => nome === linha.motivo_perda);

    leads.push({
      id: linha.id,
      // Lead sem cliente não casa com nenhuma linha do relatório, que é
      // organizado por cliente. Zero não existe como id e deixa isso explícito.
      clinicaId: linha.clinica_id ?? 0,
      etapa,
      origem,
      diasAtras: diasAtrasDe(new Date(linha.criado_em), hoje),
      ...(motivo === undefined ? {} : { motivoPerda: motivo as MotivoPerda }),
    });
  }

  return {
    leads,
    desconhecidos: { etapas: [...etapas], origens: [...origens] },
  };
}

export type AgendamentosDoBanco = {
  agendamentos: Agendamento[];
  desconhecidos: Pick<Desconhecidos, "status">;
};

/**
 * Converte as consultas do banco.
 *
 * `agendamentos` guarda a unidade, não o cliente; o relatório é por cliente.
 * O caminho é o mesmo da Visão Geral: a unidade diz de quem ela é.
 *
 * Status fora da lista deixa a consulta de fora, pelo mesmo motivo da etapa:
 * ela entraria em "não compareceu" por eliminação e estragaria o show rate.
 */
export function montarAgendamentosDoBanco(
  linhas: LinhaDeAgendamentoDoBanco[],
  clinicaDaUnidade: Map<number, number | null>,
  hoje: Date,
): AgendamentosDoBanco {
  const agendamentos: Agendamento[] = [];
  const status = new Set<string>();

  for (const linha of linhas) {
    const situacao = statusAgendamento.find((nome) => nome === linha.status);
    if (situacao === undefined) {
      status.add(linha.status);
      continue;
    }

    const dia = diaDoCalendario(linha.data_consulta);
    if (dia === null) continue;

    agendamentos.push({
      id: linha.id,
      leadId: linha.lead_id,
      clinicaId: clinicaDaUnidade.get(linha.unidade_id) ?? 0,
      criadoHaDias: diasAtrasDe(new Date(linha.criado_em), hoje),
      consultaEmDias: diasAtrasDe(dia, hoje),
      status: situacao as StatusAgendamento,
      // Igual à Visão Geral: só "IA" é fechamento da Helô, o resto é CRC.
      fechadoPor: linha.fechado_por === "IA" ? "IA" : "CRC",
      profissionalId: linha.profissional_id,
      especialidadeId: linha.especialidade_id,
      hora:
        linha.hora_consulta === null ? null : linha.hora_consulta.slice(0, 5),
      confirmada: linha.confirmada,
      ...(linha.observacao === null ? {} : { observacao: linha.observacao }),
    });
  }

  return { agendamentos, desconhecidos: { status: [...status] } };
}

/**
 * Converte os clientes do banco.
 *
 * `Clinica` é a ficha inteira do cliente, e o relatório usa três campos dela:
 * id, nome e se está ativa. O resto da ficha fica vazio de propósito — ele mora
 * em outras telas, que leem o banco por conta própria. Preencher aqui com valor
 * plausível seria inventar ficha para ninguém ler.
 */
export function montarClinicaDoBanco(
  linha: LinhaDeClinicaDoBanco,
  unidades: number,
): Clinica {
  return {
    id: linha.id,
    nome: (linha.nome ?? "").trim() || "Sem nome",
    ativa: linha.ativa ?? true,
    unidades,

    cidade: "",
    endereco: "",
    horarioFuncionamento: "",
    historia: "",
    diferenciais: "",
    tratamentoFocoId: 0,
    procedimentos: [],
    parcelasMaximas: 0,
    formasPagamento: [],
    convenios: [],
    classes: [],
    faixaEtaria: { de: 0, ate: 0 },
    principaisDores: [],
  };
}

/**
 * O aviso de quando o banco trouxe valor que a tela não desenha. Lead ou
 * consulta que sai da conta sem explicação é o pior dos dois casos.
 */
export function avisoDosDesconhecidos(
  desconhecidos: Desconhecidos,
): string | null {
  const avisos: string[] = [];
  const lista = (valores: string[]) =>
    valores.map((valor) => `"${valor}"`).join(", ");

  if (desconhecidos.etapas.length > 0) {
    avisos.push(
      `Há lead em etapa que o funil não tem: ${lista(desconhecidos.etapas)}. Esses leads ficaram fora das contas deste relatório.`,
    );
  }

  if (desconhecidos.status.length > 0) {
    avisos.push(
      `Há consulta com status que o sistema não conhece: ${lista(desconhecidos.status)}. Essas consultas ficaram fora das contas deste relatório.`,
    );
  }

  if (desconhecidos.origens.length > 0) {
    avisos.push(
      `Há lead com origem fora da lista: ${lista(desconhecidos.origens)}. Eles contam como contato pelo WhatsApp, nunca como campanha paga.`,
    );
  }

  return avisos.length > 0 ? avisos.join(" ") : null;
}
