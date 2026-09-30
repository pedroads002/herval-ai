/**
 * A via de leitura da seção Clientes — a segunda parte do painel que lê o
 * banco em vez de arquivo fixo.
 *
 * Mesmo recorte do Atendimento, e pelo mesmo motivo: `src/data/profissionais.ts`
 * continua existindo e continua alimentando as abas do Atendimento e a
 * Estratégia, que ainda não leem o banco. Trocar a fonte lá embaixo derrubaria
 * aquelas telas de uma vez. Clientes, Procedimentos e Agenda leem daqui.
 *
 * Vocabulário, igual ao do banco:
 *
 *   CLIENTE      uma linha em `clinicas` — a entidade-pai. Pode ser um
 *                profissional que atende sozinho ou uma clínica com equipe.
 *   UNIDADE      um lugar físico do cliente. Todo cliente tem no mínimo uma.
 *   PROFISSIONAL a pessoa que atende, em uma ou mais unidades do cliente.
 *   PROCEDIMENTO uma linha em `especialidades`, ligada a cada profissional.
 *
 * Roda apenas no servidor. Quem chama são os componentes de servidor de
 * `/clientes` e `/clientes/[id]`.
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

/**
 * Um procedimento, do jeito que a tela precisa mostrar.
 *
 * No banco a tabela se chama `especialidades` e continua com esse nome — as
 * telas de Estratégia e de Especialidades leem de lá. O que mudou foi a
 * palavra na tela do cadastro, que passou a dizer "procedimento", que é como a
 * agência fala. Renomear a tabela para acompanhar o rótulo derrubaria as duas
 * outras telas sem nada em troca.
 */
export type EspecialidadeDoCadastro = {
  id: number;
  nome: string;
  /** Inativa aparece riscada, como já aparecia antes. */
  ativa: boolean;
  /** Quanto tempo a consulta ocupa. É o que a Agenda escreve no cartão. */
  duracaoMinutos: number;
};

/** Como o cliente opera. É a resposta da primeira pergunta do cadastro. */
export type TipoDeOperacao = "individual" | "equipe";

/** Uma unidade, já sabendo de que cliente ela é. */
export type UnidadeDoCadastro = {
  id: number;
  nome: string;
  /**
   * Endereço e cidade da unidade, e não do cliente.
   *
   * O cliente tem os dele em `clinicas`, que é o endereço principal. Estes são
   * do lugar: quem tem duas unidades tem dois endereços, e o do cliente não
   * responde por qual é qual. Vazio é o normal em cliente de uma unidade só,
   * onde o endereço do cliente já diz tudo.
   */
  endereco: string;
  cidade: string;
  ativa: boolean;
  clienteId: number;
  clienteNome: string;
};

/**
 * Um cliente: a entidade-pai do cadastro.
 *
 * É uma linha em `clinicas`, tanto para quem atende sozinho quanto para uma
 * clínica com equipe — o que separa os dois é `tipoOperacao`, e não duas
 * tabelas. Quem atende sozinho é um cliente com um profissional só, e tratá-lo
 * como outra coisa obrigaria toda leitura do sistema a perguntar em qual das
 * duas tabelas procurar.
 */
export type ClienteDoCadastro = {
  id: number;
  nome: string;
  ativa: boolean;
  tipoOperacao: TipoDeOperacao;
  /** Como o cliente deve ser chamado. Vazio quando ninguém informou. */
  nomeExibicao: string;
  /** Só faz sentido em clínica: quem responde pela operação. */
  responsavelPrincipal: string;
  areaAtuacao: string;
  whatsapp: string;
  email: string;
  instagram: string;
  cidade: string;
  estado: string;
  endereco: string;
  descricao: string;
  unidades: UnidadeDoCadastro[];
  /** Quem atende neste cliente. Vazio é possível e não é defeito. */
  profissionais: ProfissionalCadastrado[];
};

/**
 * Quando a pessoa atende num lugar.
 *
 * É propriedade do vínculo, e não da pessoa nem da unidade: quem atende em dois
 * lugares tem um horário em cada um, e é justamente essa a informação que a
 * Agenda vai precisar para saber se dá para marcar às terças de manhã naquele
 * endereço. Por isso vem numa lista à parte, indexada pela unidade, em vez de
 * virar campo dentro de `UnidadeDoCadastro` — a unidade é a mesma para todo
 * mundo que atende nela, o horário não.
 *
 * Tudo aqui é opcional. Cliente que ainda não organizou a agenda fica sem nada
 * disso preenchido, e isso não é cadastro pela metade: é o normal de quem
 * combina horário por WhatsApp, caso a caso.
 */
export type HorarioNaUnidade = {
  unidadeId: number;
  /**
   * Os dias em que atende. `1` é segunda e `7` é domingo — a mesma numeração
   * que o CHECK da tabela aceita, e a mesma do `isodow` do Postgres, para que
   * uma consulta por dia da semana não precise traduzir nada.
   *
   * Vazio quando ninguém informou.
   */
  dias: number[];
  /** "HH:MM". Nulo quando ninguém informou — ou os dois cheios, ou os dois nulos. */
  inicio: string | null;
  fim: string | null;
};

export type ProfissionalCadastrado = {
  id: number;
  nome: string;
  /** Como a pessoa deve ser chamada na conversa. Vazio cai de volta no nome. */
  nomeExibicao: string;
  /** O que a pessoa faz principalmente. Texto livre: "Ortodontia", "Botox". */
  especialidadePrincipal: string;
  /**
   * O procedimento que não estava na lista, digitado à mão.
   *
   * Fica em texto solto, e não vira linha nova no catálogo, de propósito:
   * catálogo alimentado por digitação de formulário enche de variações da
   * mesma coisa ("Botox", "botox", "Toxina botulínica") e ninguém depois
   * consegue dizer quantos profissionais fazem aquilo.
   */
  procedimentoOutro: string;
  /**
   * De qual cliente esta pessoa é.
   *
   * Sai da unidade onde ela atende, que é o vínculo que já existia. Nulo é
   * possível só para quem foi gravado sem unidade nenhuma — o cadastro pela
   * tela não deixa isso acontecer.
   */
  clienteId: number | null;
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
  /**
   * Um item por unidade onde a pessoa atende, na mesma ordem de `unidades`.
   * Quem não informou horário nenhum aparece aqui com a lista de dias vazia e
   * as duas horas nulas — a linha do vínculo existe de todo jeito.
   */
  horarios: HorarioNaUnidade[];
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
  /**
   * Quando a leitura bateu no teto e a tela não está mostrando tudo.
   *
   * Separado de `falha` de propósito: `falha` apaga a tela, e aqui os dados que
   * vieram estão certos — só não são todos. Nulo é o normal.
   */
  aviso: string | null;
};

const SEM_DADOS: DadosDosProfissionais = {
  profissionais: [],
  clientes: [],
  especialidades: [],
  falha: null,
  aviso: null,
};

/**
 * O teto de linhas de cada leitura.
 *
 * Existe porque leitura sem teto não é leitura sem limite: o PostgREST tem um
 * máximo configurado no servidor, e quando ele corta, corta calado — a tela
 * mostra uma lista a menos e ninguém fica sabendo. Pedir um teto nosso troca um
 * corte invisível por um corte que a gente conhece e consegue avisar.
 *
 * Mil é o padrão documentado do Supabase, e é folgado: a agência tem dezenas de
 * clientes, não milhares. Se um dia bater, a tela diz, e aí paginação vira
 * trabalho com motivo em vez de trabalho por precaução.
 */
const TETO_DE_LINHAS = 1000;

/**
 * Avisa quando alguma leitura veio cheia até o teto.
 *
 * Contar o que voltou é o jeito honesto de descobrir: uma resposta com
 * exatamente mil linhas ou é coincidência exata ou é corte, e tratar as duas
 * como corte erra para o lado de avisar à toa, não para o lado de esconder.
 */
function avisoDoTeto(contagens: Record<string, number>) {
  const cheias = Object.entries(contagens)
    .filter(([, quantas]) => quantas >= TETO_DE_LINHAS)
    .map(([nome]) => nome);

  if (cheias.length === 0) return null;

  return `A tela está mostrando no máximo ${TETO_DE_LINHAS} linhas de ${cheias.join(", ")}. Nada foi perdido no banco, mas esta lista não está completa.`;
}

type LinhaProfissional = {
  id: number;
  nome: string | null;
  nome_exibicao: string | null;
  especialidade_principal: string | null;
  procedimento_outro: string | null;
  tipo: string | null;
  registro: string | null;
  ativo: boolean;
};

type LinhaUnidade = {
  id: number;
  clinica_id: number;
  nome: string | null;
  endereco: string | null;
  cidade: string | null;
  ativa: boolean;
};

type LinhaCliente = {
  id: number;
  nome: string | null;
  ativa: boolean;
  tipo_operacao: string | null;
  nome_exibicao: string | null;
  responsavel_principal: string | null;
  area_atuacao: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
  descricao: string | null;
};

const COLUNAS_DO_CLIENTE =
  "id, nome, ativa, tipo_operacao, nome_exibicao, responsavel_principal, area_atuacao, whatsapp, email, instagram, cidade, estado, endereco, descricao";

const COLUNAS_DO_PROFISSIONAL =
  "id, nome, nome_exibicao, especialidade_principal, procedimento_outro, tipo, registro, ativo";

type LinhaEspecialidade = {
  id: number;
  nome: string | null;
  ativa: boolean;
  duracao_minutos: number | null;
};

type LinhaVinculo = {
  profissional_id: number;
  especialidade_id?: number;
  unidade_id?: number;
  /** Só no vínculo de unidade, e só quando alguém preencheu. */
  dias_semana?: number[] | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
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
      .select(COLUNAS_DO_PROFISSIONAL)
      .order("nome", { ascending: true })
      .limit(TETO_DE_LINHAS),
    supabase
      .from("clinicas")
      .select(COLUNAS_DO_CLIENTE)
      .order("nome", { ascending: true })
      .limit(TETO_DE_LINHAS),
    supabase
      .from("unidades")
      .select("id, clinica_id, nome, endereco, cidade, ativa")
      .order("nome", { ascending: true })
      .limit(TETO_DE_LINHAS),
    supabase
      .from("especialidades")
      .select("id, nome, ativa, duracao_minutos")
      .order("nome", { ascending: true })
      .limit(TETO_DE_LINHAS),
    // As duas listas de ligação são mais longas que as de cima: uma pessoa que
    // realiza dez procedimentos são dez linhas. O teto aqui é o mesmo, e é
    // justamente aqui que ele seria atingido primeiro.
    supabase
      .from("profissional_especialidades")
      .select("profissional_id, especialidade_id")
      .limit(TETO_DE_LINHAS),
    supabase
      .from("profissional_unidades")
      .select("profissional_id, unidade_id, dias_semana, hora_inicio, hora_fim")
      .limit(TETO_DE_LINHAS),
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
    endereco: (linha.endereco ?? "").trim(),
    cidade: (linha.cidade ?? "").trim(),
    ativa: linha.ativa,
    clienteId: linha.clinica_id,
    clienteNome: nomesDeCliente.get(linha.clinica_id) ?? "Cliente removido",
  }));

  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));

  const especialidades: EspecialidadeDoCadastro[] = (
    (respostaEspecialidades.data ?? []) as LinhaEspecialidade[]
  ).map((linha) => ({
    id: linha.id,
    nome: nomeOu(linha.nome, "Especialidade sem nome"),
    ativa: linha.ativa,
    // Quarenta é o padrão da coluna no banco; nulo aqui só apareceria se alguém
    // apagasse o valor à mão.
    duracaoMinutos: linha.duracao_minutos ?? 40,
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
  ).map((linha) => {
    // Os vínculos de unidade desta pessoa, guardados antes de virarem unidades:
    // o horário mora no vínculo, e a unidade sozinha não o carrega.
    const vinculosDele = (unidadesPorProfissional.get(linha.id) ?? []).filter(
      (v) => unidadePorId.has(v.unidade_id as number),
    );
    const unidadesDele = vinculosDele
      .map((v) => unidadePorId.get(v.unidade_id as number))
      .filter((u): u is UnidadeDoCadastro => u !== undefined);

    return {
      id: linha.id,
      nome: nomeOu(linha.nome, "Sem nome"),
      nomeExibicao: (linha.nome_exibicao ?? "").trim(),
      especialidadePrincipal: (linha.especialidade_principal ?? "").trim(),
      procedimentoOutro: (linha.procedimento_outro ?? "").trim(),
      tipo: nomeOu(linha.tipo, "Área não informada"),
      registro: (linha.registro ?? "").trim(),
      ativo: linha.ativo,
      // De qual cliente a pessoa é: sai da unidade onde ela atende. Quem tem
      // mais de uma unidade tem todas do mesmo cliente, então a primeira
      // responde.
      clienteId: unidadesDele[0]?.clienteId ?? null,
      especialidades: (especialidadesPorProfissional.get(linha.id) ?? [])
        .map((v) => especialidadePorId.get(v.especialidade_id as number))
        .filter((e): e is EspecialidadeDoCadastro => e !== undefined),
      unidades: unidadesDele,
      horarios: vinculosDele.map((v) => ({
        unidadeId: v.unidade_id as number,
        dias: [...(v.dias_semana ?? [])].sort((a, b) => a - b),
        inicio: horaCurta(v.hora_inicio),
        fim: horaCurta(v.hora_fim),
      })),
    };
  });

  const clientes: ClienteDoCadastro[] = clientesCrus.map((linha) => ({
    id: linha.id,
    nome: nomesDeCliente.get(linha.id) ?? "Cliente sem nome",
    ativa: linha.ativa,
    tipoOperacao:
      linha.tipo_operacao === "individual" ? "individual" : "equipe",
    nomeExibicao: (linha.nome_exibicao ?? "").trim(),
    responsavelPrincipal: (linha.responsavel_principal ?? "").trim(),
    areaAtuacao: (linha.area_atuacao ?? "").trim(),
    whatsapp: (linha.whatsapp ?? "").trim(),
    email: (linha.email ?? "").trim(),
    instagram: (linha.instagram ?? "").trim(),
    cidade: (linha.cidade ?? "").trim(),
    estado: (linha.estado ?? "").trim(),
    endereco: (linha.endereco ?? "").trim(),
    descricao: (linha.descricao ?? "").trim(),
    unidades: unidades.filter((u) => u.clienteId === linha.id),
    profissionais: profissionais.filter((p) => p.clienteId === linha.id),
  }));

  return {
    profissionais,
    clientes,
    especialidades,
    falha: null,
    aviso: avisoDoTeto({
      profissionais: (respostaProfissionais.data ?? []).length,
      clientes: clientesCrus.length,
      unidades: unidades.length,
      procedimentos: especialidades.length,
      "procedimentos por pessoa": (
        respostaEspecialidadesDoProfissional.data ?? []
      ).length,
      "unidades por pessoa": (respostaUnidadesDoProfissional.data ?? []).length,
    }),
  };
}

export type DadosDeUmCliente = {
  cliente: ClienteDoCadastro | null;
  especialidades: EspecialidadeDoCadastro[];
  falha: string | null;
  /** Ver `aviso` em `DadosDosProfissionais`: leitura cortada no teto. */
  aviso: string | null;
};

/**
 * Um cliente só, com os profissionais dele, para a tela de detalhe.
 *
 * Reaproveita a leitura da seção inteira em vez de montar consultas próprias.
 * O cadastro tem dezenas de clientes, não milhares: buscar tudo e escolher um
 * custa menos do que manter duas montagens do mesmo objeto, que é onde as duas
 * telas começariam a discordar sobre o que um cliente é.
 */
export async function carregarCliente(id: number): Promise<DadosDeUmCliente> {
  const { clientes, especialidades, falha, aviso } =
    await carregarProfissionais();

  if (falha) {
    return { cliente: null, especialidades: [], falha, aviso: null };
  }

  return {
    cliente: clientes.find((c) => c.id === id) ?? null,
    especialidades,
    falha: null,
    aviso,
  };
}

/**
 * A hora do jeito que a tela usa.
 *
 * O banco guarda `time`, e o PostgREST devolve "09:00:00". O `<input type=time>`
 * e a etiqueta da tela querem "09:00" — os segundos aqui seriam sempre zero e
 * só ocupariam espaço.
 */
function horaCurta(valor: string | null | undefined) {
  if (!valor) return null;
  return valor.slice(0, 5);
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
