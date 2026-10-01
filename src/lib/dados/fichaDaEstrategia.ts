/**
 * A ficha da Estratégia do Cliente: tipos, listas fechadas e a conversão de uma
 * linha de `clinicas` na ficha que a tela desenha.
 *
 * Por que isto mora separado do módulo que lê o banco: o mesmo motivo de
 * `linhaDoFunil.ts`. Aqui não há sessão, não há Supabase e não há `"use server"`
 * — então esta conversão pode ser rodada sozinha e conferida sem subir nada. É
 * também o único arquivo desta seção que um componente de tela pode importar
 * para pegar tipo: importar do módulo de leitura arrastaria o cliente do
 * Supabase para dentro do navegador.
 *
 * As listas fechadas aparecem duas vezes de propósito: aqui e como CHECK em
 * `supabase/estrategia-do-cliente.sql`. É a mesma decisão de
 * `motivo-perda-do-lead.sql` — a tela não oferece o que o banco recusaria, e o
 * banco não aceita o que a tela não oferece. Mexer numa lista é mexer nos dois
 * lugares, e é por isso que o SQL cita este arquivo no comentário dele.
 */

export const OBJETIVOS_DE_ATENDIMENTO = [
  "Agendar avaliação",
  "Agendar consulta",
  "Qualificar antes do agendamento",
  "Encaminhar para humano",
  "Outro",
] as const;

export const PRIORIDADES_COMERCIAIS = [
  "Volume de agendamentos",
  "Ocupar agenda ociosa",
  "Procedimento carro-chefe",
  "Fidelizar base",
] as const;

export const TIPOS_DE_AVALIACAO = ["Presencial", "Online", "Ambas"] as const;

export const QUANDO_A_AVALIACAO_E_COBRADA = [
  "Sempre",
  "Só quando o paciente não fecha o procedimento",
  "Só em alguns procedimentos",
  "Nunca",
] as const;

export const POLITICAS_DE_VALORES = [
  "Pode informar",
  "Só a partir de",
  "Só se perguntarem",
  "Não informa antes da avaliação",
] as const;

export const FORMAS_DE_PAGAMENTO = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Financiamento próprio",
] as const;

export const CLASSES_ECONOMICAS = ["A", "B", "C", "D"] as const;

/** O mesmo teto do CHECK em `clinicas.parcelamento`. */
export const PARCELAMENTO_MAXIMO = 24;

/** As mesmas bordas do CHECK das duas idades. */
export const IDADE_MINIMA = 0;
export const IDADE_MAXIMA = 120;

export type ObjetivoDeAtendimento = (typeof OBJETIVOS_DE_ATENDIMENTO)[number];
export type PrioridadeComercial = (typeof PRIORIDADES_COMERCIAIS)[number];
export type TipoDeAvaliacao = (typeof TIPOS_DE_AVALIACAO)[number];
export type QuandoCobrada = (typeof QUANDO_A_AVALIACAO_E_COBRADA)[number];
export type PoliticaDeValores = (typeof POLITICAS_DE_VALORES)[number];
export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number];
export type ClasseEconomica = (typeof CLASSES_ECONOMICAS)[number];

/** Um convênio e os procedimentos que ele cobre. Vazio quer dizer "nenhum". */
export type ConvenioDaFicha = {
  nome: string;
  especialidadeIds: number[];
};

/**
 * A linha de `clinicas` como o Supabase devolve: nome de coluna do banco, e
 * tudo podendo vir nulo, porque nulo aqui quer dizer "ninguém cadastrou ainda".
 */
export type LinhaDaClinica = {
  id: number;
  nome: string | null;
  cidade: string | null;
  ativa: boolean | null;
  objetivo_atendimento: string | null;
  prioridade_comercial: string | null;
  tem_avaliacao_inicial: boolean | null;
  tipo_avaliacao: string | null;
  avaliacao_gratuita: boolean | null;
  avaliacao_quando_cobrada: string | null;
  avaliacao_abate_procedimento: boolean | null;
  helo_pode_informar_valor: boolean | null;
  politica_de_valores: string | null;
  formas_pagamento: string[] | null;
  parcelamento: number | null;
  convenios: unknown;
  classe_economica: string[] | null;
  faixa_etaria_de: number | null;
  faixa_etaria_ate: number | null;
  principais_dores: string[] | null;
  tom_predominante: string | null;
  diferenciais: string | null;
  informacoes_a_evitar: string | null;
  observacoes_atendimento: string | null;
  historia: string | null;
  endereco: string | null;
  horario_funcionamento: string | null;
};

export type FichaDaEstrategia = {
  clienteId: number;
  nome: string;

  // Bloco 1 — Objetivo do Atendimento
  objetivo: ObjetivoDeAtendimento | null;
  prioridade: PrioridadeComercial | null;

  // Bloco 2 — Avaliação/Consulta
  temAvaliacaoInicial: boolean | null;
  tipoDeAvaliacao: TipoDeAvaliacao | null;
  avaliacaoGratuita: boolean | null;
  quandoCobrada: QuandoCobrada | null;
  avaliacaoAbateNoProcedimento: boolean | null;
  heloPodeInformarValor: boolean | null;

  // Bloco 3 — Condições Comerciais
  formasDePagamento: FormaDePagamento[];
  parcelamentoMaximo: number | null;
  convenios: ConvenioDaFicha[];
  politicaDeValores: PoliticaDeValores | null;

  // Bloco 4 — Público-alvo
  classes: ClasseEconomica[];
  faixaEtariaDe: number | null;
  faixaEtariaAte: number | null;
  principaisDores: string[];

  // Bloco 5 — Diretrizes de Comunicação
  tomPredominante: string;
  diferenciais: string;
  informacoesAEvitar: string;
  observacoesDeAtendimento: string;
  historia: string;

  /*
    Só exibição, nunca edição: endereço e horário são da ficha de Clientes, e
    quem manda neles é aquela tela. Aparecem aqui porque a Helô fala os dois com
    o paciente, e quem está escrevendo a estratégia precisa ver o que ela diria.
  */
  endereco: string;
  horarioDeFuncionamento: string;
};

/** Um cliente na lista do seletor. Só o necessário para escolher. */
export type ClienteDoSeletor = {
  id: number;
  nome: string;
  cidade: string;
  ativa: boolean;
};

/*
  Um valor do banco só entra na ficha se estiver na lista fechada.

  Parece redundante com o CHECK, e quase sempre é. Mas o CHECK nasceu hoje, e
  nada impede alguém de rodar um `update` direto no SQL Editor amanhã, ou de uma
  lista encurtar aqui sem o banco ser limpo junto. Nesses casos a resposta certa
  é "não cadastrado", que a tela já sabe desenhar — e não um valor fora de lista
  entrando num `<select>` que não tem essa opção, o que faria o campo aparecer
  vazio como se nunca tivesse sido preenchido.
*/
function daLista<T extends string>(
  valor: string | null | undefined,
  lista: readonly T[],
): T | null {
  if (valor === null || valor === undefined) return null;
  return lista.includes(valor as T) ? (valor as T) : null;
}

function listaDaLista<T extends string>(
  valores: string[] | null | undefined,
  lista: readonly T[],
): T[] {
  if (!Array.isArray(valores)) return [];
  // A ordem é a da lista fechada, não a do banco: assim a tela não muda de
  // aparência só porque alguém marcou as caixas em outra sequência.
  return lista.filter((item) => valores.includes(item));
}

/** Texto nulo vira string vazia, que é o que um `<textarea>` sabe receber. */
function texto(valor: string | null | undefined): string {
  return (valor ?? "").trim();
}

function inteiroEntre(
  valor: number | null | undefined,
  minimo: number,
  maximo: number,
): number | null {
  if (typeof valor !== "number" || !Number.isInteger(valor)) return null;
  return valor >= minimo && valor <= maximo ? valor : null;
}

/*
  Os convênios vêm de uma coluna jsonb, e jsonb é a única coisa desta ficha que o
  banco não consegue conferir por valor — o CHECK só garante que é uma lista. O
  conteúdo é lido com desconfiança, item por item, pelo mesmo motivo que a
  consulta do n8n filtra id que não é número: um item torto não pode derrubar a
  tela inteira, tem é de ser ignorado.
*/
export function montarConvenios(bruto: unknown): ConvenioDaFicha[] {
  if (!Array.isArray(bruto)) return [];

  const convenios: ConvenioDaFicha[] = [];

  for (const item of bruto) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const registro = item as Record<string, unknown>;
    const nome = typeof registro.nome === "string" ? registro.nome.trim() : "";

    // Convênio sem nome não é convênio: não tem o que mostrar nem o que a Helô
    // falaria. É o mesmo descarte que a consulta do cérebro faz.
    if (nome === "") continue;

    const ids = Array.isArray(registro.especialidade_ids)
      ? registro.especialidade_ids
      : [];

    const especialidadeIds: number[] = [];
    for (const id of ids) {
      const numero = typeof id === "number" ? id : Number(id);
      if (Number.isInteger(numero) && numero > 0) especialidadeIds.push(numero);
    }

    convenios.push({ nome, especialidadeIds });
  }

  return convenios;
}

export function montarFichaDaEstrategia(
  linha: LinhaDaClinica,
): FichaDaEstrategia {
  return {
    clienteId: linha.id,
    nome: texto(linha.nome) || "Sem nome",

    objetivo: daLista(linha.objetivo_atendimento, OBJETIVOS_DE_ATENDIMENTO),
    prioridade: daLista(linha.prioridade_comercial, PRIORIDADES_COMERCIAIS),

    temAvaliacaoInicial: linha.tem_avaliacao_inicial ?? null,
    tipoDeAvaliacao: daLista(linha.tipo_avaliacao, TIPOS_DE_AVALIACAO),
    avaliacaoGratuita: linha.avaliacao_gratuita ?? null,
    quandoCobrada: daLista(
      linha.avaliacao_quando_cobrada,
      QUANDO_A_AVALIACAO_E_COBRADA,
    ),
    avaliacaoAbateNoProcedimento: linha.avaliacao_abate_procedimento ?? null,
    heloPodeInformarValor: linha.helo_pode_informar_valor ?? null,

    formasDePagamento: listaDaLista(
      linha.formas_pagamento,
      FORMAS_DE_PAGAMENTO,
    ),
    parcelamentoMaximo: inteiroEntre(
      linha.parcelamento,
      1,
      PARCELAMENTO_MAXIMO,
    ),
    convenios: montarConvenios(linha.convenios),
    politicaDeValores: daLista(linha.politica_de_valores, POLITICAS_DE_VALORES),

    classes: listaDaLista(linha.classe_economica, CLASSES_ECONOMICAS),
    faixaEtariaDe: inteiroEntre(
      linha.faixa_etaria_de,
      IDADE_MINIMA,
      IDADE_MAXIMA,
    ),
    faixaEtariaAte: inteiroEntre(
      linha.faixa_etaria_ate,
      IDADE_MINIMA,
      IDADE_MAXIMA,
    ),
    // Dor é texto que o cliente escreve, não lista fechada: não há o que
    // conferir contra nada, só descartar linha vazia.
    principaisDores: Array.isArray(linha.principais_dores)
      ? linha.principais_dores.map((dor) => dor.trim()).filter((dor) => dor)
      : [],

    tomPredominante: texto(linha.tom_predominante),
    diferenciais: texto(linha.diferenciais),
    informacoesAEvitar: texto(linha.informacoes_a_evitar),
    observacoesDeAtendimento: texto(linha.observacoes_atendimento),
    historia: texto(linha.historia),

    endereco: texto(linha.endereco),
    horarioDeFuncionamento: texto(linha.horario_funcionamento),
  };
}
