/**
 * O período da Visão Geral, em data de calendário.
 *
 * Por que um tipo novo em vez de reaproveitar o `Faixa` de `relatorios.ts`: lá o
 * período é "quantos dias atrás", porque os dados em memória guardam
 * `criadoHaDias`. Aqui o período precisa virar data absoluta, porque é ela que
 * vai na consulta ao Supabase (`criado_em` de `leads`, `data_consulta` de
 * `agendamentos`). Esticar o `Faixa` para servir aos dois casos acoplaria esta
 * tela a Relatórios — e Relatórios continua, de propósito, lendo memória.
 *
 * Este arquivo é puro: não lê banco e não tem estado. Por isso pode ser
 * importado tanto pela página (servidor) quanto pelo seletor (navegador).
 */

/** Datas no formato YYYY-MM-DD, as duas pontas inclusas. */
export type IntervaloDeDatas = { de: string; ate: string };

export type NomeDoPeriodo =
  | "hoje"
  | "7d"
  | "30d"
  | "este-mes"
  | "mes-passado"
  | "personalizado";

/**
 * A mesma lista, na mesma ordem, dos presets de Relatórios — e o período
 * inicial das duas telas é o mesmo ("Este mês").
 *
 * Até 17/11/2026 cada tela tinha a sua lista: a Visão Geral abria em "Hoje" com
 * Hoje / 7 dias / 30 dias / Personalizado, e Relatórios abria em "Este mês" com
 * Hoje / 7 dias / Este mês / Mês passado. Abertas lado a lado, a mesma base dava
 * 36 leads numa tela e 265 na outra, e não havia como igualar as duas: faltava
 * "Este mês" aqui e "Últimos 30 dias" lá. Nenhum dos números estava errado, mas
 * a tela fazia parecer que estavam.
 */
export const periodosDaVisao: { nome: NomeDoPeriodo; rotulo: string }[] = [
  { nome: "hoje", rotulo: "Hoje" },
  { nome: "7d", rotulo: "Últimos 7 dias" },
  { nome: "30d", rotulo: "Últimos 30 dias" },
  { nome: "este-mes", rotulo: "Este mês" },
  { nome: "mes-passado", rotulo: "Mês passado" },
  { nome: "personalizado", rotulo: "Personalizado" },
];

const FUSO = "America/Sao_Paulo";
const DIA_EM_MS = 86_400_000;
const FORMATO_DE_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O fim do dia de Brasília em fuso fixo -03:00.
 *
 * Dá para fixar o deslocamento porque o Brasil não tem mais horário de verão
 * desde 2019. Se isso voltar algum dia, é aqui que muda — e só aqui.
 */
const DESLOCAMENTO = "-03:00";

/** Que dia é hoje em Brasília. `en-CA` é o locale que já devolve YYYY-MM-DD. */
export function diaDeHoje(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
}

export function somarDias(dia: string, dias: number): string {
  const [ano, mes, data] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, data) + dias * DIA_EM_MS)
    .toISOString()
    .slice(0, 10);
}

/** Quantos dias o intervalo cobre, contando as duas pontas. */
export function diasDoIntervalo({ de, ate }: IntervaloDeDatas): number {
  const inicio = Date.parse(`${de}T00:00:00Z`);
  const fim = Date.parse(`${ate}T00:00:00Z`);
  return Math.round((fim - inicio) / DIA_EM_MS) + 1;
}

/** O período imediatamente anterior, de mesma duração. */
export function intervaloAnterior(
  intervalo: IntervaloDeDatas,
): IntervaloDeDatas {
  const dias = diasDoIntervalo(intervalo);
  return {
    de: somarDias(intervalo.de, -dias),
    ate: somarDias(intervalo.de, -1),
  };
}

/** O começo do primeiro dia, para comparar com uma coluna `timestamptz`. */
export function primeiroInstante(intervalo: IntervaloDeDatas): string {
  return `${intervalo.de}T00:00:00.000${DESLOCAMENTO}`;
}

/** O último instante do último dia, idem. */
export function ultimoInstante(intervalo: IntervaloDeDatas): string {
  return `${intervalo.ate}T23:59:59.999${DESLOCAMENTO}`;
}

function ehDiaValido(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    FORMATO_DE_DIA.test(valor) &&
    !Number.isNaN(Date.parse(`${valor}T00:00:00Z`))
  );
}

export type PeriodoEscolhido = {
  nome: NomeDoPeriodo;
  intervalo: IntervaloDeDatas;
};

/**
 * Traduz o que veio na URL para um intervalo de datas.
 *
 * Qualquer coisa fora do esperado cai em "hoje" em vez de quebrar a tela: a URL
 * é digitável, e endereço torto não deveria derrubar o painel.
 */
export function resolverPeriodo(
  nome?: string | string[],
  de?: string | string[],
  ate?: string | string[],
): PeriodoEscolhido {
  const hoje = diaDeHoje();

  if (nome === "personalizado" && ehDiaValido(de) && ehDiaValido(ate)) {
    // Datas invertidas são desentendimento de quem digitou, não erro: basta ler
    // na ordem certa.
    const intervalo =
      de <= ate ? { de, ate } : { de: ate as string, ate: de as string };
    return { nome: "personalizado", intervalo };
  }

  if (nome === "7d") {
    return { nome: "7d", intervalo: { de: somarDias(hoje, -6), ate: hoje } };
  }

  if (nome === "30d") {
    return { nome: "30d", intervalo: { de: somarDias(hoje, -29), ate: hoje } };
  }

  if (nome === "hoje") {
    return { nome: "hoje", intervalo: { de: hoje, ate: hoje } };
  }

  if (nome === "mes-passado") {
    return { nome: "mes-passado", intervalo: mesRelativo(hoje, -1) };
  }

  // O padrão é "Este mês", igual a Relatórios: é o recorte em que as duas telas
  // abrem, e por isso o que elas mostram uma ao lado da outra.
  return { nome: "este-mes", intervalo: mesRelativo(hoje, 0) };
}

/**
 * O mês inteiro, do dia 1 ao último dia — e não até hoje.
 *
 * Vai até o fim do mês pelo mesmo motivo do preset de Relatórios: consulta já
 * marcada para os próximos dias ocupa este mês, e parar em hoje a deixaria de
 * fora do mês que ela ocupa. Lead não existe no futuro, então nada é inventado
 * na conta de lead.
 */
function mesRelativo(hoje: string, deslocamento: number): IntervaloDeDatas {
  const [ano, mes] = hoje.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, mes - 1 + deslocamento, 1));
  const ultimo = new Date(Date.UTC(ano, mes + deslocamento, 0));
  return {
    de: primeiro.toISOString().slice(0, 10),
    ate: ultimo.toISOString().slice(0, 10),
  };
}

function emDiaEMes(dia: string) {
  const [, mes, data] = dia.split("-");
  return `${data}/${mes}`;
}

/** "hoje", "nos últimos 7 dias", "entre 01/09 e 30/09". */
export function descricaoDoIntervalo(periodo: PeriodoEscolhido): string {
  if (periodo.nome === "hoje") return "hoje";
  if (periodo.nome === "7d") return "nos últimos 7 dias";
  if (periodo.nome === "30d") return "nos últimos 30 dias";
  if (periodo.nome === "este-mes") return "neste mês";
  if (periodo.nome === "mes-passado") return "no mês passado";

  const { de, ate } = periodo.intervalo;
  if (de === ate) return `em ${emDiaEMes(de)}`;
  return `entre ${emDiaEMes(de)} e ${emDiaEMes(ate)}`;
}

/** O mesmo texto, mas servindo de rótulo curto: "Hoje", "01/09 a 30/09". */
export function rotuloDoIntervalo(periodo: PeriodoEscolhido): string {
  if (periodo.nome === "personalizado") {
    const { de, ate } = periodo.intervalo;
    return de === ate ? emDiaEMes(de) : `${emDiaEMes(de)} a ${emDiaEMes(ate)}`;
  }

  return (
    periodosDaVisao.find((opcao) => opcao.nome === periodo.nome)?.rotulo ??
    "Este mês"
  );
}
