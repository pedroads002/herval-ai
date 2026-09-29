/**
 * A via de leitura da seção Profissionais — a segunda parte do painel que lê o
 * banco em vez de arquivo fixo.
 *
 * Mesmo recorte do Atendimento, e pelo mesmo motivo: `src/data/profissionais.ts`
 * continua existindo e continua alimentando Agenda, Especialidades e Estratégia,
 * que ainda não leem o banco. Trocar a fonte lá embaixo derrubaria aquelas três
 * telas de uma vez. Então só esta seção lê daqui.
 *
 * Vocabulário, igual ao do banco:
 *
 *   CLIENTE      uma linha em `clinicas`. Sempre uma por cliente, tenha ele dez
 *                unidades ou nenhuma.
 *   UNIDADE      um lugar físico do cliente. Todo cliente tem no mínimo uma.
 *   PROFISSIONAL a pessoa que atende, em uma ou mais unidades.
 *
 * Roda apenas no servidor. Quem chama é o componente de servidor de
 * `/profissionais`.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

// A lista de cargos mora em arquivo próprio, porque o formulário (que roda no
// navegador) precisa dela e não pode arrastar este módulo junto. Fica
// reexportada aqui para quem já a importava daqui.
export {
  tiposDeProfissional,
  type TipoDeProfissional,
} from "@/lib/dados/tiposDeProfissional";

/** Uma especialidade, do jeito que a tela precisa mostrar. */
export type EspecialidadeDoCadastro = {
  id: number;
  nome: string;
  /** Inativa aparece riscada, como já aparecia antes. */
  ativa: boolean;
};

/** Uma unidade, já sabendo de que cliente ela é. */
export type UnidadeDoCadastro = {
  id: number;
  nome: string;
  ativa: boolean;
  clienteId: number;
  clienteNome: string;
};

/** Um cliente com as unidades dele. É este o agrupamento do "onde atende". */
export type ClienteDoCadastro = {
  id: number;
  nome: string;
  ativa: boolean;
  unidades: UnidadeDoCadastro[];
};

export type ProfissionalCadastrado = {
  id: number;
  nome: string;
  /**
   * Não é o tipo fechado, e sim o que está gravado.
   *
   * O CHECK da tabela já garante que só os dezessete entram, então na prática
   * é sempre um deles. Ficar `TipoDeProfissional` aqui obrigaria a inventar um
   * desvio para o valor inesperado — e as duas saídas seriam ruins: trocar por
   * outro cargo seria mentir sobre a formação de alguém, e descartar faria o
   * profissional desaparecer da tela. Mostrar a palavra que está no banco é a
   * única resposta honesta.
   */
  tipo: string;
  /** Conselho de classe. Vazio é comum: esteticista não tem. */
  registro: string;
  ativo: boolean;
  especialidades: EspecialidadeDoCadastro[];
  unidades: UnidadeDoCadastro[];
};

export type DadosDosProfissionais = {
  profissionais: ProfissionalCadastrado[];
  /** Todos os clientes, com as unidades. Alimenta o "onde atende" do cadastro. */
  clientes: ClienteDoCadastro[];
  especialidades: EspecialidadeDoCadastro[];
  /**
   * Por que a tela está vazia, quando estiver. Separa "ninguém cadastrado
   * ainda" de "não consegui ler o banco" — sem isso as duas viram a mesma tela
   * em branco, e a segunda é defeito.
   */
  falha: string | null;
};

const SEM_DADOS: DadosDosProfissionais = {
  profissionais: [],
  clientes: [],
  especialidades: [],
  falha: null,
};

type LinhaProfissional = {
  id: number;
  nome: string | null;
  tipo: string | null;
  registro: string | null;
  ativo: boolean;
};

type LinhaUnidade = {
  id: number;
  clinica_id: number;
  nome: string | null;
  ativa: boolean;
};

type LinhaCliente = {
  id: number;
  nome: string | null;
  ativa: boolean;
};

type LinhaEspecialidade = {
  id: number;
  nome: string | null;
  ativa: boolean;
};

type LinhaVinculo = {
  profissional_id: number;
  especialidade_id?: number;
  unidade_id?: number;
};

/**
 * Carrega a seção inteira: quem atende, o que cada um faz, onde faz, e a lista
 * de clientes e especialidades que o cadastro oferece.
 *
 * As cinco consultas vão juntas, e **todas as cinco são obrigatórias**. A
 * tentação é deixar as ligações falharem em silêncio, como o Atendimento faz
 * com as notas, mas aqui isso produziria mentira: um profissional sem nenhuma
 * etiqueta de especialidade é exatamente o que se vê quando a ligação não
 * carregou *e* quando a pessoa realmente não atende nada. Duas situações
 * diferentes com a mesma cara, sendo que uma é defeito.
 *
 * Profissional inativo e unidade inativa vêm na lista, com a marca. Filtrar
 * aqui esconderia da tela a informação de que existem — quem decide o que
 * mostrar é a tela.
 */
export async function carregarProfissionais(): Promise<DadosDosProfissionais> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  const [
    respostaProfissionais,
    respostaClientes,
    respostaUnidades,
    respostaEspecialidades,
    respostaEspecialidadesDoProfissional,
    respostaUnidadesDoProfissional,
  ] = await Promise.all([
    supabase
      .from("profissionais")
      .select("id, nome, tipo, registro, ativo")
      .order("nome", { ascending: true }),
    supabase
      .from("clinicas")
      .select("id, nome, ativa")
      .order("nome", { ascending: true }),
    supabase
      .from("unidades")
      .select("id, clinica_id, nome, ativa")
      .order("nome", { ascending: true }),
    supabase
      .from("especialidades")
      .select("id, nome, ativa")
      .order("nome", { ascending: true }),
    // As colunas de dia e horário existem em `profissional_unidades`, mas não
    // são lidas aqui: nenhuma tela mostra horário ainda, e campo carregado sem
    // ninguém usar é peso morto. Entram quando a Agenda precisar.
    supabase
      .from("profissional_especialidades")
      .select("profissional_id, especialidade_id"),
    supabase.from("profissional_unidades").select("profissional_id, unidade_id"),
  ]);

  const erro =
    respostaProfissionais.error ??
    respostaClientes.error ??
    respostaUnidades.error ??
    respostaEspecialidades.error ??
    respostaEspecialidadesDoProfissional.error ??
    respostaUnidadesDoProfissional.error;

  if (erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler o cadastro: ${erro.message}`,
    };
  }

  const nomeOu = (valor: string | null, reserva: string) =>
    (valor ?? "").trim() || reserva;

  const clientesCrus = (respostaClientes.data ?? []) as LinhaCliente[];
  const nomesDeCliente = new Map<number, string>(
    clientesCrus.map((c) => [c.id, nomeOu(c.nome, "Cliente sem nome")]),
  );

  const unidades: UnidadeDoCadastro[] = (
    (respostaUnidades.data ?? []) as LinhaUnidade[]
  ).map((linha) => ({
    id: linha.id,
    nome: nomeOu(linha.nome, "Unidade sem nome"),
    ativa: linha.ativa,
    clienteId: linha.clinica_id,
    clienteNome: nomesDeCliente.get(linha.clinica_id) ?? "Cliente removido",
  }));

  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));

  const clientes: ClienteDoCadastro[] = clientesCrus.map((linha) => ({
    id: linha.id,
    nome: nomesDeCliente.get(linha.id) ?? "Cliente sem nome",
    ativa: linha.ativa,
    unidades: unidades.filter((u) => u.clienteId === linha.id),
  }));

  const especialidades: EspecialidadeDoCadastro[] = (
    (respostaEspecialidades.data ?? []) as LinhaEspecialidade[]
  ).map((linha) => ({
    id: linha.id,
    nome: nomeOu(linha.nome, "Especialidade sem nome"),
    ativa: linha.ativa,
  }));

  const especialidadePorId = new Map(especialidades.map((e) => [e.id, e]));

  // As ligações são varridas uma vez e indexadas por profissional, em vez de
  // uma consulta por pessoa.
  const especialidadesPorProfissional = agrupar(
    (respostaEspecialidadesDoProfissional.data ?? []) as LinhaVinculo[],
    (v) => v.profissional_id,
  );
  const unidadesPorProfissional = agrupar(
    (respostaUnidadesDoProfissional.data ?? []) as LinhaVinculo[],
    (v) => v.profissional_id,
  );

  const profissionais: ProfissionalCadastrado[] = (
    (respostaProfissionais.data ?? []) as LinhaProfissional[]
  ).map((linha) => ({
    id: linha.id,
    nome: nomeOu(linha.nome, "Sem nome"),
    tipo: nomeOu(linha.tipo, "Cargo não informado"),
    registro: (linha.registro ?? "").trim(),
    ativo: linha.ativo,
    especialidades: (especialidadesPorProfissional.get(linha.id) ?? [])
      .map((v) => especialidadePorId.get(v.especialidade_id as number))
      .filter((e): e is EspecialidadeDoCadastro => e !== undefined),
    unidades: (unidadesPorProfissional.get(linha.id) ?? [])
      .map((v) => unidadePorId.get(v.unidade_id as number))
      .filter((u): u is UnidadeDoCadastro => u !== undefined),
  }));

  return { profissionais, clientes, especialidades, falha: null };
}

/** Junta uma lista de ligações por profissional, numa passada. */
function agrupar<T>(itens: T[], chave: (item: T) => number) {
  const mapa = new Map<number, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const atual = mapa.get(k);
    if (atual) atual.push(item);
    else mapa.set(k, [item]);
  }
  return mapa;
}
