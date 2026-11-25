/**
 * A via de leitura da tela de Pacientes.
 *
 * Paciente é o mesmo registro de `leads` — esta tela é outra forma de olhar a
 * mesma base que o Funil desenha em colunas. A diferença é o recorte: aqui a
 * lista é alfabética, paginada no banco (25 por vez) e filtrada no banco, para
 * não depender do teto de 1000 linhas que o quadro do Funil tem.
 *
 * O isolamento entre clínicas é do RLS: a sessão de um cliente só enxerga a
 * própria operação. O filtro de cliente que vem da URL só vale para a Herval,
 * e mesmo para ela é só um recorte, não uma permissão.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { ehHervalAdmin, PAPEIS, type Autorizacao } from "@/lib/autorizacao";
import type { EtapaFunil } from "@/data/leads";
import {
  etapaDaLista,
  limparBusca,
  PACIENTES_POR_PAGINA,
  type OpcaoSimples,
  type PacienteDaLista,
} from "@/lib/dados/linhaDePaciente";

export type FiltrosDePacientes = {
  /** Só a Herval escolhe. Para cliente, é sempre a própria clínica. */
  clienteId: number | null;
  etapa: EtapaFunil | null;
  busca: string;
  pagina: number;
};

export type DadosDePacientes = {
  pacientes: PacienteDaLista[];
  /** Pacientes da base no recorte de cliente, sem etapa nem busca. */
  totalNaBase: number;
  /** Pacientes que o filtro e a busca deixaram, em todas as páginas. */
  totalFiltrado: number;
  /** Soma de tudo o que foi registrado em `vendas`, no recorte de cliente. */
  totalVendido: number;
  /** Falso quando a soma das vendas não pôde ser lida. */
  vendasLidas: boolean;
  /** Para a Herval escolher a clínica. Vazio para cliente. */
  clientes: OpcaoSimples[];
  /** Procedimentos ativos, para o "procedimento de interesse" da edição. */
  procedimentos: OpcaoSimples[];
  /** Herval e admin da clínica excluem; o colaborador não. */
  podeExcluir: boolean;
  /** A Herval vê de qual cliente é cada paciente. */
  mostrarCliente: boolean;
  falha: string | null;
};

/**
 * O PostgREST devolve no máximo mil linhas por pedido. Para somar, exportar ou
 * procurar duplicados é preciso ler tudo, então a leitura vai em páginas.
 * `cortado` avisa quando o teto parou a leitura antes do fim.
 */
export async function lerEmPaginas<T>(
  montar: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  teto = 20000,
): Promise<{ linhas: T[]; erro: string | null; cortado: boolean }> {
  const linhas: T[] = [];
  const tamanho = 1000;

  for (let de = 0; de < teto; de += tamanho) {
    const { data, error } = await montar(de, de + tamanho - 1);
    if (error) return { linhas, erro: error.message, cortado: false };
    linhas.push(...(data ?? []));
    if ((data ?? []).length < tamanho) {
      return { linhas, erro: null, cortado: false };
    }
  }

  return { linhas, erro: null, cortado: true };
}

/** Lê os filtros da URL sem confiar neles. */
export function lerFiltros(
  parametros: { [chave: string]: string | string[] | undefined },
  autorizacao: Autorizacao,
): FiltrosDePacientes {
  const texto = (chave: string) => {
    const valor = parametros[chave];
    return typeof valor === "string" ? valor : "";
  };

  const cliente = Number(texto("cliente"));
  const pagina = Number(texto("pagina"));

  return {
    clienteId:
      ehHervalAdmin(autorizacao) && Number.isInteger(cliente) && cliente > 0
        ? cliente
        : null,
    etapa: etapaDaLista(texto("etapa")),
    busca: limparBusca(texto("busca")),
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

export async function carregarPacientes(
  filtros: FiltrosDePacientes,
  autorizacao: Autorizacao,
): Promise<DadosDePacientes> {
  const herval = ehHervalAdmin(autorizacao);
  const base: DadosDePacientes = {
    pacientes: [],
    totalNaBase: 0,
    totalFiltrado: 0,
    totalVendido: 0,
    vendasLidas: false,
    clientes: [],
    procedimentos: [],
    podeExcluir: herval || autorizacao.papel === PAPEIS.CLIENTE_ADMIN,
    mostrarCliente: herval,
    falha: null,
  };

  if (!supabaseConfigurado()) {
    return { ...base, falha: "O Supabase não está configurado neste ambiente." };
  }

  const supabase = await criarClienteServidor();
  const { clienteId, etapa, busca } = filtros;

  // A lista da página.
  let lista = supabase
    .from("leads")
    .select("id, nome, telefone, etapa, clinica_id, especialidade_interesse_id", {
      count: "exact",
    });
  if (clienteId !== null) lista = lista.eq("clinica_id", clienteId);
  if (etapa !== null) lista = lista.eq("etapa", etapa);
  const filtroDeBusca = montarFiltroDeBusca(busca);
  if (filtroDeBusca) lista = lista.or(filtroDeBusca);

  // O total da base, sem etapa nem busca: é o número do topo da tela.
  let contagem = supabase.from("leads").select("id", { count: "exact", head: true });
  if (clienteId !== null) contagem = contagem.eq("clinica_id", clienteId);

  const vendas = lerEmPaginas<{ valor: number | string }>((de, ate) => {
    let consulta = supabase.from("vendas").select("valor");
    if (clienteId !== null) consulta = consulta.eq("clinica_id", clienteId);
    return consulta.order("id", { ascending: true }).range(de, ate);
  });

  const inicio = (filtros.pagina - 1) * PACIENTES_POR_PAGINA;

  const [respostaDaLista, respostaDaContagem, respostaDasVendas, respostaDosClientes, respostaDosProcedimentos] =
    await Promise.all([
      lista
        .order("nome", { ascending: true })
        .order("id", { ascending: true })
        .range(inicio, inicio + PACIENTES_POR_PAGINA - 1),
      contagem,
      vendas,
      supabase.from("clinicas").select("id, nome").limit(1000),
      supabase
        .from("especialidades")
        .select("id, nome")
        .eq("ativa", true)
        .order("nome", { ascending: true })
        .limit(1000),
    ]);

  // Página além da última (alguém excluiu pacientes, ou digitou o número na
  // mão): o PostgREST responde erro de faixa. Não é falha, é página vazia.
  const foraDaFaixa =
    respostaDaLista.error?.code === "PGRST103" ||
    /range/i.test(respostaDaLista.error?.message ?? "");

  if (respostaDaLista.error && !foraDaFaixa) {
    return {
      ...base,
      falha: `Não deu para ler os pacientes: ${respostaDaLista.error.message}`,
    };
  }

  const nomesDosClientes = new Map<number, string>();
  for (const cliente of (respostaDosClientes.data ?? []) as {
    id: number;
    nome: string | null;
  }[]) {
    nomesDosClientes.set(cliente.id, (cliente.nome ?? "").trim() || "Sem nome");
  }

  const pacientes: PacienteDaLista[] = foraDaFaixa
    ? []
    : (
        (respostaDaLista.data ?? []) as {
          id: number;
          nome: string | null;
          telefone: string | null;
          etapa: string;
          clinica_id: number | null;
          especialidade_interesse_id: number | null;
        }[]
      ).map((linha) => ({
        id: linha.id,
        nome: (linha.nome ?? "").trim() || "Paciente sem nome",
        telefone: (linha.telefone ?? "").trim(),
        // Como está gravada. O banco não fecha a lista e o n8n também escreve
        // aqui: etapa desconhecida aparece do jeito que está, e trocar a etapa
        // por esta tela corrige o registro.
        etapa: linha.etapa,
        clinicaId: linha.clinica_id,
        cliente:
          linha.clinica_id === null
            ? null
            : (nomesDosClientes.get(linha.clinica_id) ?? null),
        especialidadeId: linha.especialidade_interesse_id,
      }));

  let totalVendido = 0;
  if (!respostaDasVendas.erro) {
    let centavos = 0;
    for (const { valor } of respostaDasVendas.linhas) {
      centavos += Math.round(Number(valor) * 100);
    }
    totalVendido = centavos / 100;
  }

  return {
    ...base,
    pacientes,
    totalNaBase: respostaDaContagem.count ?? 0,
    totalFiltrado: foraDaFaixa ? 0 : (respostaDaLista.count ?? 0),
    totalVendido,
    vendasLidas: !respostaDasVendas.erro,
    clientes: herval
      ? [...nomesDosClientes]
          .map(([id, nome]) => ({ id, nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      : [],
    procedimentos: ((respostaDosProcedimentos.data ?? []) as {
      id: number;
      nome: string | null;
    }[]).map((p) => ({ id: p.id, nome: (p.nome ?? "").trim() || "Sem nome" })),
  };
}

/**
 * Nome por pedaço do texto; telefone pelos dígitos, a partir de três (menos
 * que isso casaria com quase todo número da base). O termo já chega limpo de
 * vírgula e parêntese por `limparBusca`.
 */
export function montarFiltroDeBusca(busca: string): string | null {
  if (busca === "") return null;
  const digitos = busca.replace(/\D/g, "");
  const partes = [`nome.ilike.*${busca}*`];
  if (digitos.length >= 3) partes.push(`telefone.ilike.*${digitos}*`);
  return partes.join(",");
}
