"use server";

/**
 * As gravações da seção Clientes.
 *
 * A entidade-pai é o CLIENTE — uma linha em `clinicas` —, e o fluxo começa numa
 * pergunta: esse cliente é um profissional que atende sozinho, ou uma clínica
 * com equipe? A resposta muda o formulário, não o modelo de dados: os dois
 * caminhos gravam um cliente, e os profissionais pendurados nele.
 *
 *   cadastrarIndividual   cliente e profissional na mesma ação, com o mesmo
 *                         nome, porque são a mesma pessoa.
 *   cadastrarCliente      a clínica, quando existe equipe. Primeiro passo.
 *   cadastrarProfissional cada pessoa da equipe. Repetido quantas vezes
 *                         precisar, e também usado na tela do cliente.
 *   editarCliente         / excluirCliente
 *   editarProfissional    / excluirProfissional
 *   cadastrarUnidade      / editarUnidade / excluirUnidade — os lugares do
 *                         cliente. A primeira unidade não passa por aqui: quem
 *                         a cria é o gatilho do banco, junto com o cliente.
 *
 * Roda no servidor. O navegador manda o formulário, nunca o comando.
 *
 * Por que a conferência de sessão está aqui dentro, e não só no proxy: uma
 * ação de servidor é um endereço POST como outro qualquer. O proxy protege a
 * *tela*; quem chamasse a ação direto não passaria por tela nenhuma. Sem esta
 * conferência, a última tranca seria a RLS — que sozinha resolveria, mas
 * deixar a porta anterior aberta de propósito é confiar numa tranca só.
 */

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { tiposDeProfissional } from "@/lib/dados/tiposDeProfissional";
import { estados } from "@/lib/dados/estados";
import type {
  ClienteCriado,
  ResultadoDoCadastro,
} from "@/lib/acoes/resultadoDoCadastro";

const LIMITE_NOME = 120;
const LIMITE_REGISTRO = 60;
const LIMITE_CURTO = 120;
const LIMITE_DESCRICAO = 600;

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(
  mensagem: string,
  cliente?: ClienteCriado,
): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now(), cliente };
}

type ClienteDoServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Sessão válida ou o motivo da recusa. Nunca as duas coisas. */
async function exigirSessao(): Promise<
  { erro: string } | { supabase: ClienteDoServidor }
> {
  if (!supabaseConfigurado()) {
    return { erro: "O Supabase não está configurado neste ambiente." };
  }

  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { erro: "Sua sessão expirou. Entre de novo para cadastrar." };
  }

  return { supabase };
}

/** Lê um campo de texto do formulário já aparado. */
function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

/** Campo opcional: vazio vira nulo, e não texto vazio. */
function opcional(formData: FormData, campo: string) {
  const valor = texto(formData, campo);
  return valor === "" ? null : valor;
}

/** Caixa marcada. Ausente é "não". */
function marcado(formData: FormData, campo: string) {
  return formData.get(campo) !== null;
}

/** Lê um número inteiro positivo, ou nada. */
function numero(formData: FormData, campo: string) {
  const n = Number(texto(formData, campo));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Lê uma lista de caixas marcadas como números.
 *
 * Valor que não é número inteiro positivo é descartado em silêncio de
 * propósito: essas caixas são geradas pela própria tela, então qualquer outra
 * coisa chegando aqui é pedido adulterado, não engano de quem cadastra. O que
 * sobra ainda passa pela chave estrangeira do banco.
 */
function numeros(formData: FormData, campo: string) {
  const vistos = new Set<number>();
  for (const bruto of formData.getAll(campo)) {
    const n = Number(bruto);
    if (Number.isInteger(n) && n > 0) vistos.add(n);
  }
  return [...vistos];
}

/**
 * Quando a pessoa atende em cada lugar, do jeito que a tabela guarda.
 *
 * `null` nos três campos é a resposta normal de quem não organizou agenda: o
 * vínculo existe, o horário não foi informado. O que não pode existir é meio
 * horário — e as três regras abaixo são as mesmas três do banco, escritas aqui
 * para o erro chegar como frase em vez de violação de CHECK.
 */
type HorarioGravavel = {
  dias_semana: number[] | null;
  hora_inicio: string | null;
  hora_fim: string | null;
};

/**
 * Horário em branco, escrito por extenso.
 *
 * Existe para que toda gravação mande as três colunas mesmo quando não há nada
 * a informar. Omitir as colunas no `insert` daria o mesmo resultado, mas no
 * `update` deixaria o horário antigo de pé — e "apaguei o horário e ele voltou"
 * é a pior cara possível de um campo editável.
 */
const SEM_HORARIO: HorarioGravavel = {
  dias_semana: null,
  hora_inicio: null,
  hora_fim: null,
};

/** "07:30" sim; "7:30", "24:00" e qualquer outra coisa, não. */
const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Lê o horário de cada unidade escolhida.
 *
 * Os campos chegam nomeados por unidade (`horario-12-dias`, `horario-12-inicio`,
 * `horario-12-fim`), porque o horário é de um par pessoa-lugar e um campo só
 * não daria conta de quem atende em dois endereços em dias diferentes.
 *
 * `nomes` só entra nas frases de erro: "a hora de fim tem que ser depois da de
 * início" sem dizer em qual unidade manda procurar o campo errado na tela.
 */
function lerHorarios(
  formData: FormData,
  unidadeIds: number[],
  nomes: Map<number, string>,
): { erro: string } | Map<number, HorarioGravavel> {
  const porUnidade = new Map<number, HorarioGravavel>();

  for (const unidadeId of unidadeIds) {
    const dias = numeros(formData, `horario-${unidadeId}-dias`)
      .filter((d) => d >= 1 && d <= 7)
      .sort((a, b) => a - b);
    const inicio = opcional(formData, `horario-${unidadeId}-inicio`);
    const fim = opcional(formData, `horario-${unidadeId}-fim`);
    const onde = nomes.get(unidadeId) ?? "unidade";

    if ((inicio === null) !== (fim === null)) {
      return {
        erro: `Em ${onde}, informe a hora de início e a de fim — ou deixe as duas em branco.`,
      };
    }

    if (inicio !== null && fim !== null) {
      if (!HORA.test(inicio) || !HORA.test(fim)) {
        return { erro: `Em ${onde}, o horário está fora do formato 00:00.` };
      }
      // Comparação de texto resolve: "HH:MM" com dois dígitos sempre ordena
      // igual ao relógio.
      if (fim <= inicio) {
        return {
          erro: `Em ${onde}, a hora de fim tem que ser depois da de início.`,
        };
      }
    }

    porUnidade.set(unidadeId, {
      dias_semana: dias.length === 0 ? null : dias,
      hora_inicio: inicio,
      hora_fim: fim,
    });
  }

  return porUnidade;
}

/** O tamanho de um campo, quando ele existe. Devolve o motivo ou nada. */
function longoDemais(valor: string | null, limite: number, campo: string) {
  if (valor !== null && valor.length > limite) {
    return `O campo "${campo}" passou de ${limite} caracteres.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// O que os dois caminhos leem
// ---------------------------------------------------------------------------

/** Os campos que descrevem o cliente, sem os da pessoa. */
type DadosDoCliente = {
  nome: string;
  nome_exibicao: string | null;
  responsavel_principal: string | null;
  area_atuacao: string;
  whatsapp: string;
  email: string | null;
  instagram: string | null;
  cidade: string;
  estado: string;
  endereco: string | null;
  descricao: string | null;
  ativa: boolean;
};

/**
 * Confere os campos do cliente.
 *
 * `comoChamaONome` muda só a frase do erro: no caminho individual o campo é o
 * nome da pessoa, no de equipe é o nome da clínica, e um erro dizendo "o nome
 * da clínica é obrigatório" para quem preencheu o próprio nome manda procurar
 * um campo que não está na tela.
 */
function lerCliente(
  formData: FormData,
  comoChamaONome: string,
): { erro: string } | DadosDoCliente {
  const nome = texto(formData, "nome");
  const area = texto(formData, "area_atuacao");
  const whatsapp = texto(formData, "whatsapp");
  const cidade = texto(formData, "cidade");
  const estado = texto(formData, "estado");
  const email = opcional(formData, "email");
  const instagram = opcional(formData, "instagram");
  const endereco = opcional(formData, "endereco");
  const descricao = opcional(formData, "descricao");

  if (nome === "") return { erro: `${comoChamaONome} é obrigatório.` };
  if (nome.length > LIMITE_NOME) {
    return { erro: `O nome passou de ${LIMITE_NOME} caracteres.` };
  }

  // A mesma lista que trava a coluna `tipo` no banco. Conferir aqui é o que
  // produz uma frase em português em vez do erro cru do CHECK — e é o que
  // permite usar a área do cliente como área de quem atende nele.
  if (!(tiposDeProfissional as readonly string[]).includes(area)) {
    return { erro: "Escolha a área de atuação." };
  }
  if (whatsapp === "") return { erro: "O WhatsApp é obrigatório." };
  if (cidade === "") return { erro: "A cidade é obrigatória." };
  if (!(estados as readonly string[]).includes(estado)) {
    return { erro: "Escolha o estado." };
  }
  // Conferência de e-mail de propósito frouxa: só recusa o que claramente não
  // é endereço. Regra apertada aqui recusa endereço válido e incomum, e o
  // prejuízo de não cadastrar um cliente é maior que o de guardar um e-mail
  // torto que alguém corrige depois.
  if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erro: "O e-mail não parece um endereço válido." };
  }

  const excedeu =
    longoDemais(whatsapp, LIMITE_CURTO, "WhatsApp") ??
    longoDemais(email, LIMITE_CURTO, "E-mail") ??
    longoDemais(instagram, LIMITE_CURTO, "Instagram") ??
    longoDemais(cidade, LIMITE_CURTO, "Cidade") ??
    longoDemais(endereco, LIMITE_NOME * 2, "Endereço") ??
    longoDemais(descricao, LIMITE_DESCRICAO, "Descrição curta");

  if (excedeu) return { erro: excedeu };

  return {
    nome,
    nome_exibicao: opcional(formData, "nome_exibicao"),
    responsavel_principal: opcional(formData, "responsavel_principal"),
    area_atuacao: area,
    whatsapp,
    email,
    instagram,
    cidade,
    estado,
    endereco,
    descricao,
    ativa: marcado(formData, "ativa"),
  };
}

/** Os campos da pessoa. Valem para os dois caminhos do fluxo. */
type DadosDaPessoa = {
  nome: string;
  nome_exibicao: string;
  especialidade_principal: string;
  procedimento_outro: string | null;
  registro: string | null;
  ativo: boolean;
  especialidadeIds: number[];
};

function lerPessoa(formData: FormData): { erro: string } | DadosDaPessoa {
  const nome = texto(formData, "nome");
  const comoChamar = texto(formData, "nome_exibicao");
  const principal = texto(formData, "especialidade_principal");
  const registro = opcional(formData, "registro");
  const outro = opcional(formData, "procedimento_outro");
  const especialidadeIds = numeros(formData, "especialidades");

  if (nome === "") return { erro: "O nome do profissional é obrigatório." };
  if (nome.length > LIMITE_NOME) {
    return { erro: `O nome passou de ${LIMITE_NOME} caracteres.` };
  }
  if (comoChamar === "") {
    return { erro: "Diga como o profissional deve ser chamado." };
  }
  if (principal === "") {
    return { erro: "A especialidade principal é obrigatória." };
  }

  const excedeu =
    longoDemais(comoChamar, LIMITE_NOME, "Como deve ser chamado") ??
    longoDemais(principal, LIMITE_CURTO, "Especialidade principal") ??
    longoDemais(registro, LIMITE_REGISTRO, "Registro") ??
    longoDemais(outro, LIMITE_CURTO, "Qual procedimento/tratamento");

  if (excedeu) return { erro: excedeu };

  // "Outro" preenchido conta como procedimento. Sem isso, quem só faz algo
  // fora da lista não conseguiria cadastrar — e é justamente esse caso que o
  // campo "Outro" existe para atender.
  if (especialidadeIds.length === 0 && outro === null) {
    return { erro: "Marque pelo menos um procedimento que a pessoa realiza." };
  }

  return {
    nome,
    nome_exibicao: comoChamar,
    especialidade_principal: principal,
    procedimento_outro: outro,
    registro,
    ativo: marcado(formData, "ativo"),
    especialidadeIds,
  };
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

/**
 * Grava uma linha em `clinicas` e devolve ela já com a unidade.
 *
 * A primeira unidade não é criada aqui: existe um gatilho no banco que a cria
 * junto, com o mesmo nome do cliente. Duplicar isso no painel daria duas
 * unidades para quem cadastrasse por aqui e uma para quem cadastrasse por fora.
 *
 * Quantas unidades o cliente tem não é gravado em lugar nenhum: conta-se as
 * linhas de `unidades`. Existiu uma coluna `numero_unidades` para isso, um
 * número digitado à mão que podia discordar da contagem real — e um número que
 * pode mentir sobre um fato que o banco já sabe responder é pior que número
 * nenhum. Ela saiu junto com esta mudança.
 *
 * Se o gatilho não tiver criado a unidade, o cliente é apagado e o cadastro
 * falha. Cliente sem unidade nenhuma é um cliente onde ninguém pode ser
 * encaixado: entregá-lo assim seria entregar um cadastro que não serve.
 */
async function criarCliente(
  supabase: ClienteDoServidor,
  dados: DadosDoCliente,
  tipoOperacao: "individual" | "equipe",
): Promise<{ erro: string } | { cliente: ClienteCriado }> {
  const { data: criado, error } = await supabase
    .from("clinicas")
    .insert({ ...dados, tipo_operacao: tipoOperacao })
    .select("id, nome")
    .single();

  if (error || !criado) {
    return {
      erro: `não deu para cadastrar o cliente (${error?.message ?? "o banco não devolveu o cadastro"})`,
    };
  }

  const { data: unidades, error: erroDasUnidades } = await supabase
    .from("unidades")
    .select("id, nome")
    .eq("clinica_id", criado.id)
    .order("id", { ascending: true });

  if (erroDasUnidades || !unidades || unidades.length === 0) {
    // O `on delete cascade` de `unidades` leva junto o que tiver entrado.
    await supabase.from("clinicas").delete().eq("id", criado.id);
    return {
      erro: `o cliente foi criado sem nenhuma unidade (${erroDasUnidades?.message ?? "o gatilho do banco não criou a unidade inicial"})`,
    };
  }

  return {
    cliente: {
      id: criado.id,
      nome: criado.nome ?? dados.nome,
      unidades: unidades.map((u) => ({ id: u.id, nome: u.nome ?? dados.nome })),
    },
  };
}

/**
 * Passo um do caminho "clínica ou equipe".
 *
 * Só os dados da operação. Quem atende ali é cadastrado na sequência, na mesma
 * tela, com a unidade que voltou daqui já escolhida.
 */
export async function cadastrarCliente(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const dados = lerCliente(formData, "O nome da clínica");
  if ("erro" in dados) return recusar(dados.erro);

  if (dados.responsavel_principal === null) {
    return recusar("O responsável principal é obrigatório.");
  }

  const resultado = await criarCliente(sessao.supabase, dados, "equipe");
  if ("erro" in resultado) return recusar(`Não deu: ${resultado.erro}.`);

  revalidatePath("/clientes");
  return aceitar(
    `Cliente "${resultado.cliente.nome}" cadastrado. Agora cadastre quem atende.`,
    resultado.cliente,
  );
}

/**
 * O caminho "profissional individual": cliente e profissional numa gravação só.
 *
 * O nome é pedido uma vez e serve aos dois. Quem atende sozinho *é* o cliente —
 * pedir "nome da clínica" e "nome do profissional" separados para a mesma
 * pessoa seria inventar uma clínica que não existe e fazer quem cadastra
 * digitar o próprio nome duas vezes.
 *
 * Não há campo de unidade: a única unidade é a que o gatilho cria junto com o
 * cliente, e é nela que a pessoa é encaixada.
 *
 * São várias gravações e o Supabase não as junta numa transação. Qualquer falha
 * depois da primeira apaga o cliente, e o `on delete cascade` leva unidade e
 * vínculos junto. Meio cadastro é pior que nenhum: ficaria um cliente vazio na
 * lista, com cara de cliente de verdade.
 */
export async function cadastrarIndividual(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const dados = lerCliente(formData, "O nome");
  if ("erro" in dados) return recusar(dados.erro);

  const pessoa = lerPessoa(formData);
  if ("erro" in pessoa) return recusar(pessoa.erro);

  const resultado = await criarCliente(sessao.supabase, dados, "individual");
  if ("erro" in resultado) return recusar(`Não deu: ${resultado.erro}.`);

  const { cliente } = resultado;

  // Sem horário, e não por esquecimento: a unidade nasce nesta mesma gravação,
  // pelo gatilho do banco, então o formulário não tinha um número de unidade
  // para pendurar horário nenhum. Quem quiser informar abre a ficha da pessoa
  // depois de cadastrada, onde o bloco de horário existe.
  const erro = await gravarPessoa(
    sessao.supabase,
    pessoa,
    dados.area_atuacao,
    [cliente.unidades[0].id],
    new Map(),
  );

  if (erro) {
    const { error: erroAoDesfazer } = await sessao.supabase
      .from("clinicas")
      .delete()
      .eq("id", cliente.id);

    if (erroAoDesfazer) {
      // Caso raro e o único que deixa sujeira. Dizer o número torna o conserto
      // possível, em vez de virar um cadastro fantasma sem explicação.
      return recusar(
        `O cadastro falhou (${erro}) e não deu para desfazer: o cliente nº ${cliente.id} ficou gravado sem ninguém atendendo.`,
      );
    }

    return recusar(`Não deu para cadastrar: ${erro}`);
  }

  revalidatePath("/clientes");
  return aceitar(`${pessoa.nome} cadastrado, atendendo por conta própria.`);
}

/**
 * Muda os dados de um cliente que já existe.
 *
 * Não mexe em `tipo_operacao`: trocar um individual por clínica depois de
 * cadastrado mudaria o sentido dos profissionais pendurados nele, e o caminho
 * honesto para isso é cadastrar o cliente certo, não reescrever o antigo.
 */
export async function editarCliente(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual cliente editar.");

  const ehEquipe = texto(formData, "tipo_operacao") === "equipe";
  const dados = lerCliente(formData, ehEquipe ? "O nome da clínica" : "O nome");
  if ("erro" in dados) return recusar(dados.erro);

  if (ehEquipe && dados.responsavel_principal === null) {
    return recusar("O responsável principal é obrigatório.");
  }

  const { error } = await sessao.supabase
    .from("clinicas")
    .update(dados)
    .eq("id", id);

  if (error) return recusar(`Não deu para salvar: ${error.message}`);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return aceitar("Alterações salvas.");
}

/**
 * Salva um cliente individual: os dados dele e os da pessoa, de uma vez.
 *
 * Existe separada da edição de clínica porque, aqui, o cliente e a pessoa são
 * a mesma. Dois formulários lado a lado pedindo o mesmo nome deixariam os dois
 * cadastros discordarem no dia em que alguém corrigisse só um.
 */
export async function editarIndividual(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  const pessoaId = numero(formData, "profissional");
  if (id === null) return recusar("Não deu para saber qual cliente editar.");

  const dados = lerCliente(formData, "O nome");
  if ("erro" in dados) return recusar(dados.erro);

  const pessoa = lerPessoa(formData);
  if ("erro" in pessoa) return recusar(pessoa.erro);

  const { error } = await sessao.supabase
    .from("clinicas")
    .update(dados)
    .eq("id", id);

  if (error) return recusar(`Não deu para salvar: ${error.message}`);

  // Cliente individual sem profissional é cadastro que nasceu torto ou perdeu
  // a pessoa no meio do caminho. Salvar só a parte do cliente e dizer que deu
  // certo esconderia isso.
  if (pessoaId === null) {
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
    return recusar(
      "Os dados do cliente foram salvos, mas este cliente está sem profissional. Cadastre quem atende.",
    );
  }

  const erro = await salvarPessoa(
    sessao.supabase,
    pessoaId,
    pessoa,
    dados.area_atuacao,
  );
  if (erro) return recusar(erro);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return aceitar("Alterações salvas.");
}

/**
 * Apaga um cliente e tudo que é dele.
 *
 * Os profissionais são apagados à mão, antes: eles não têm chave estrangeira
 * para `clinicas` — pertencem ao cliente através da unidade onde atendem —, e
 * o cascade do banco não os alcança. Sem este passo, apagar um cliente
 * deixaria as pessoas dele soltas no cadastro, sem cliente nenhum, aparecendo
 * como se atendessem em lugar nenhum.
 *
 * Lead aponta para cliente sem cascade, de propósito: conversa não é detalhe
 * de cadastro. Se houver lead, o banco recusa — e a recusa é traduzida aqui,
 * porque "violates foreign key constraint" não diz a ninguém o que fazer.
 */
export async function excluirCliente(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual cliente excluir.");

  const { data: unidades, error: erroDasUnidades } = await sessao.supabase
    .from("unidades")
    .select("id")
    .eq("clinica_id", id);

  if (erroDasUnidades) {
    return recusar(`Não deu para excluir: ${erroDasUnidades.message}`);
  }

  const unidadeIds = (unidades ?? []).map((u) => u.id);

  if (unidadeIds.length > 0) {
    const { data: vinculos, error: erroDosVinculos } = await sessao.supabase
      .from("profissional_unidades")
      .select("profissional_id")
      .in("unidade_id", unidadeIds);

    if (erroDosVinculos) {
      return recusar(`Não deu para excluir: ${erroDosVinculos.message}`);
    }

    const pessoaIds = [
      ...new Set((vinculos ?? []).map((v) => v.profissional_id)),
    ];

    if (pessoaIds.length > 0) {
      const { error: erroDasPessoas } = await sessao.supabase
        .from("profissionais")
        .delete()
        .in("id", pessoaIds);

      if (erroDasPessoas) {
        return recusar(
          `Não deu para excluir os profissionais do cliente: ${erroDasPessoas.message}`,
        );
      }
    }
  }

  const { error } = await sessao.supabase
    .from("clinicas")
    .delete()
    .eq("id", id);

  if (error) {
    // 23503 é violação de chave estrangeira. O único caminho que sobra é o
    // lead, porque todo o resto já foi apagado acima.
    if (error.code === "23503") {
      return recusar(
        "Este cliente tem leads no Atendimento. Apagá-lo apagaria a conversa junto, então o banco recusou. Fale comigo antes de excluir.",
      );
    }
    return recusar(`Não deu para excluir: ${error.message}`);
  }

  revalidatePath("/clientes");
  return aceitar("Cliente excluído.");
}

// ---------------------------------------------------------------------------
// Profissional
// ---------------------------------------------------------------------------

/**
 * Cada pessoa da equipe, uma por vez.
 *
 * O cliente já existe quando esta ação roda — foi criado no passo anterior do
 * fluxo, ou já estava cadastrado. O que chega aqui é em qual unidade dele a
 * pessoa atende; quando o cliente tem uma unidade só, a tela manda ela num
 * campo escondido e ninguém precisa escolher nada.
 */
export async function cadastrarProfissional(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const clienteId = numero(formData, "cliente");
  if (clienteId === null) {
    return recusar("Não deu para saber de qual cliente é este profissional.");
  }

  const pessoa = lerPessoa(formData);
  if ("erro" in pessoa) return recusar(pessoa.erro);

  const escolhidas = await unidadesEscolhidas(
    sessao.supabase,
    clienteId,
    numeros(formData, "unidades"),
  );
  if ("erro" in escolhidas) return recusar(escolhidas.erro);

  const horarios = lerHorarios(formData, escolhidas.ids, escolhidas.nomes);
  if ("erro" in horarios) return recusar(horarios.erro);

  const area = await areaDoCliente(sessao.supabase, clienteId);
  if ("erro" in area) return recusar(area.erro);

  const erro = await gravarPessoa(
    sessao.supabase,
    pessoa,
    area.area_atuacao,
    escolhidas.ids,
    horarios,
  );
  if (erro) return recusar(`Não deu para cadastrar: ${erro}`);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  return aceitar(`${pessoa.nome} cadastrado.`);
}

/**
 * Muda os dados de quem já está cadastrado.
 *
 * Os procedimentos são regravados inteiros — apaga os vínculos e insere os que
 * vieram — em vez de comparar um a um. A lista tem dezenas de itens, não
 * milhares, e comparar diferenças aqui seria mais código para o mesmo
 * resultado, com mais lugar para errar.
 *
 * Onde a pessoa atende também é editável, e só entre as unidades do mesmo
 * cliente — ver `unidadesEscolhidas`. Os lugares não seguem a regra dos
 * procedimentos: eles são o único vínculo que diz de qual cliente a pessoa é,
 * então regravar do zero é arriscado demais. Ver `trocarUnidades`.
 */
export async function editarProfissional(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) {
    return recusar("Não deu para saber qual profissional editar.");
  }

  const clienteId = numero(formData, "cliente");
  if (clienteId === null) {
    return recusar("Não deu para saber de qual cliente é este profissional.");
  }

  const pessoa = lerPessoa(formData);
  if ("erro" in pessoa) return recusar(pessoa.erro);

  const escolhidas = await unidadesEscolhidas(
    sessao.supabase,
    clienteId,
    numeros(formData, "unidades"),
  );
  if ("erro" in escolhidas) return recusar(escolhidas.erro);

  const horarios = lerHorarios(formData, escolhidas.ids, escolhidas.nomes);
  if ("erro" in horarios) return recusar(horarios.erro);

  const erro = await salvarPessoa(sessao.supabase, id, pessoa, null);
  if (erro) return recusar(erro);

  const erroDosLugares = await trocarUnidades(
    sessao.supabase,
    id,
    escolhidas.ids,
    horarios,
  );
  if (erroDosLugares) return recusar(erroDosLugares);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  return aceitar("Alterações salvas.");
}

/** Apaga uma pessoa. Os vínculos dela vão junto, por cascade do banco. */
export async function excluirProfissional(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) {
    return recusar("Não deu para saber qual profissional excluir.");
  }

  const { error } = await sessao.supabase
    .from("profissionais")
    .delete()
    .eq("id", id);

  if (error) return recusar(`Não deu para excluir: ${error.message}`);

  const clienteId = numero(formData, "cliente");
  revalidatePath("/clientes");
  if (clienteId !== null) revalidatePath(`/clientes/${clienteId}`);
  return aceitar("Profissional excluído.");
}

// ---------------------------------------------------------------------------
// Unidade
// ---------------------------------------------------------------------------

const LIMITE_ENDERECO = 200;

/** Os campos de uma unidade, conferidos. */
function lerUnidade(
  formData: FormData,
):
  | { erro: string }
  | { nome: string; endereco: string | null; cidade: string | null } {
  const nome = texto(formData, "nome");
  if (nome === "") return { erro: "O nome da unidade é obrigatório." };

  const endereco = opcional(formData, "endereco");
  const cidade = opcional(formData, "cidade");

  const excedeu =
    longoDemais(nome, LIMITE_NOME, "Nome da unidade") ??
    longoDemais(endereco, LIMITE_ENDERECO, "Endereço") ??
    longoDemais(cidade, LIMITE_CURTO, "Cidade");
  if (excedeu) return { erro: excedeu };

  return { nome, endereco, cidade };
}

/**
 * A recusa do banco quando o nome já existe naquele cliente, em português.
 *
 * A chave única é `(clinica_id, nome)`: dois lugares com o mesmo nome no mesmo
 * cliente não dá para distinguir na hora de dizer onde alguém atende, e é
 * justamente isso que a lista de unidades do cadastro de profissional mostra.
 */
function nomeDeUnidadeRepetido(error: { code?: string }) {
  return error.code === "23505"
    ? "Este cliente já tem uma unidade com esse nome. Use um nome que diferencie os dois lugares."
    : null;
}

/**
 * Cadastra outra unidade de um cliente que já existe.
 *
 * A primeira unidade não passa por aqui: quem a cria é o gatilho do banco, na
 * hora em que o cliente nasce. Esta ação é para a segunda em diante — o cliente
 * que abriu outro endereço.
 */
export async function cadastrarUnidade(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const clienteId = numero(formData, "cliente");
  if (clienteId === null) {
    return recusar("Não deu para saber de qual cliente é a unidade.");
  }

  const dados = lerUnidade(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const { error } = await sessao.supabase
    .from("unidades")
    .insert({ clinica_id: clienteId, ...dados });

  if (error) {
    return recusar(
      nomeDeUnidadeRepetido(error) ??
        `Não deu para cadastrar a unidade: ${error.message}`,
    );
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  return aceitar(`Unidade "${dados.nome}" cadastrada.`);
}

/** Muda nome, endereço, cidade e situação de uma unidade. */
export async function editarUnidade(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual unidade editar.");

  const dados = lerUnidade(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const { error } = await sessao.supabase
    .from("unidades")
    .update({ ...dados, ativa: marcado(formData, "ativa") })
    .eq("id", id);

  if (error) {
    return recusar(
      nomeDeUnidadeRepetido(error) ?? `Não deu para salvar: ${error.message}`,
    );
  }

  const clienteId = numero(formData, "cliente");
  revalidatePath("/clientes");
  if (clienteId !== null) revalidatePath(`/clientes/${clienteId}`);
  return aceitar("Unidade salva.");
}

/**
 * Apaga uma unidade, com duas recusas antes.
 *
 * `profissional_unidades` tem cascade para `unidades`, e é por isso que as duas
 * conferências existem: sem elas, apagar a unidade desligaria em silêncio quem
 * atende nela. Como o cliente de um profissional é deduzido da unidade onde ele
 * atende, a pessoa não ficaria "sem unidade" — ficaria sem cliente, fora de
 * qualquer ficha, impossível de achar na tela para consertar.
 *
 *   última unidade      cliente sem unidade nenhuma é cliente onde ninguém
 *                       pode ser cadastrado. É o mesmo motivo pelo qual o
 *                       cadastro de cliente desfaz tudo se o gatilho falhar.
 *   deixaria alguém sem
 *   lugar de atendimento quem atende em duas e perde uma continua com a outra;
 *                       quem atende só nesta some do cadastro. Trocar a pessoa
 *                       de unidade não existe na tela, então a recusa oferece
 *                       desativar — a saída que de fato está lá.
 *
 * Desativar é a saída para quem quer fechar um lugar sem mexer em ninguém: a
 * unidade sai das escolhas de cadastro e continua existindo para quem já está
 * lá.
 */
export async function excluirUnidade(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  const clienteId = numero(formData, "cliente");
  if (id === null || clienteId === null) {
    return recusar("Não deu para saber qual unidade excluir.");
  }

  const { data: doCliente, error: erroDoCliente } = await sessao.supabase
    .from("unidades")
    .select("id")
    .eq("clinica_id", clienteId);

  if (erroDoCliente) {
    return recusar(`Não deu para excluir: ${erroDoCliente.message}`);
  }

  if ((doCliente ?? []).length <= 1) {
    return recusar(
      "Esta é a única unidade do cliente, e cliente sem unidade é cliente onde ninguém pode atender. Para fechar o lugar, desative a unidade.",
    );
  }

  const impedimento = await quemFicariaSemLugar(sessao.supabase, id);
  if (typeof impedimento === "string") return recusar(impedimento);

  const { error } = await sessao.supabase
    .from("unidades")
    .delete()
    .eq("id", id);

  if (error) return recusar(`Não deu para excluir: ${error.message}`);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  return aceitar("Unidade excluída.");
}

/**
 * Quem perderia o único lugar onde atende se esta unidade fosse apagada.
 *
 * Devolve o motivo da recusa, ou nada quando ninguém fica sem lugar.
 */
async function quemFicariaSemLugar(
  supabase: ClienteDoServidor,
  unidadeId: number,
) {
  const { data: aqui, error: erroDaqui } = await supabase
    .from("profissional_unidades")
    .select("profissional_id")
    .eq("unidade_id", unidadeId);

  if (erroDaqui) return `Não deu para excluir: ${erroDaqui.message}`;

  const pessoaIds = [...new Set((aqui ?? []).map((v) => v.profissional_id))];
  if (pessoaIds.length === 0) return null;

  const { data: todos, error: erroDosVinculos } = await supabase
    .from("profissional_unidades")
    .select("profissional_id, unidade_id")
    .in("profissional_id", pessoaIds);

  if (erroDosVinculos)
    return `Não deu para excluir: ${erroDosVinculos.message}`;

  const sobra = new Set(
    (todos ?? [])
      .filter((v) => v.unidade_id !== unidadeId)
      .map((v) => v.profissional_id),
  );
  const orfaos = pessoaIds.filter((pessoaId) => !sobra.has(pessoaId));
  if (orfaos.length === 0) return null;

  const { data: pessoas } = await supabase
    .from("profissionais")
    .select("id, nome")
    .in("id", orfaos);

  const nomes = (pessoas ?? [])
    .map((p) => (p.nome ?? "").trim() || "sem nome")
    .join(", ");

  // As três saídas oferecidas são as três que existem de fato na tela: mudar a
  // unidade da pessoa ao editá-la, desativar o lugar, ou excluir a pessoa.
  return orfaos.length === 1
    ? `${nomes} atende só nesta unidade. Apagá-la deixaria essa pessoa sem cliente nenhum, fora de qualquer ficha. Edite a pessoa e mude a unidade dela, desative este lugar, ou exclua a pessoa antes.`
    : `${nomes} atendem só nesta unidade. Apagá-la deixaria essas pessoas sem cliente nenhum, fora de qualquer ficha. Edite cada uma e mude a unidade dela, desative este lugar, ou exclua essas pessoas antes.`;
}

/**
 * Regrava os dados de quem já existe, e os procedimentos junto.
 *
 * Os procedimentos são regravados inteiros — apaga os vínculos e insere os que
 * vieram — em vez de comparar um a um. A lista tem dezenas de itens, não
 * milhares, e comparar diferenças aqui seria mais código para o mesmo
 * resultado, com mais lugar para errar.
 *
 * `area` só vem quando a área de atuação foi editada junto, que é o caso do
 * cliente individual. Nos outros, a área da pessoa é a do cliente e não muda
 * ao editar a pessoa.
 *
 * Devolve o motivo da falha, ou nada.
 */
async function salvarPessoa(
  supabase: ClienteDoServidor,
  id: number,
  pessoa: DadosDaPessoa,
  area: string | null,
) {
  const { error } = await supabase
    .from("profissionais")
    .update({
      nome: pessoa.nome,
      nome_exibicao: pessoa.nome_exibicao,
      especialidade_principal: pessoa.especialidade_principal,
      procedimento_outro: pessoa.procedimento_outro,
      registro: pessoa.registro,
      ativo: pessoa.ativo,
      ...(area === null ? {} : { tipo: area }),
    })
    .eq("id", id);

  if (error) return `Não deu para salvar: ${error.message}`;

  const { error: erroAoLimpar } = await supabase
    .from("profissional_especialidades")
    .delete()
    .eq("profissional_id", id);

  if (erroAoLimpar) {
    return `Os dados foram salvos, mas os procedimentos não: ${erroAoLimpar.message}`;
  }

  if (pessoa.especialidadeIds.length === 0) return null;

  const { error: erroAoLigar } = await supabase
    .from("profissional_especialidades")
    .insert(
      pessoa.especialidadeIds.map((especialidade_id) => ({
        profissional_id: id,
        especialidade_id,
      })),
    );

  if (erroAoLigar) {
    return `Os dados foram salvos, mas os procedimentos não: ${erroAoLigar.message}`;
  }

  return null;
}

/**
 * Os lugares escolhidos no formulário, conferidos contra o cliente.
 *
 * A conferência não é formalidade. `profissional_unidades` é o vínculo que diz
 * de qual cliente a pessoa é — o painel deduz o cliente da unidade, porque
 * `profissionais` não tem coluna de cliente. Uma unidade de outro cliente aqui
 * mudaria a pessoa de ficha sem ninguém ter pedido isso, e deixaria a área de
 * atuação dela, herdada do cliente antigo, apontando para o lugar errado.
 *
 * A tela só oferece as unidades deste cliente. Esta é a tranca de quem chamasse
 * a ação direto, sem passar por tela nenhuma.
 *
 * Devolve os nomes junto porque a mesma consulta já os traz, e quem valida o
 * horário precisa deles para dizer em qual lugar está o campo errado.
 */
async function unidadesEscolhidas(
  supabase: ClienteDoServidor,
  clienteId: number,
  unidadeIds: number[],
): Promise<{ erro: string } | { ids: number[]; nomes: Map<number, string> }> {
  if (unidadeIds.length === 0) {
    return { erro: "Marque pelo menos um lugar onde a pessoa atende." };
  }

  const { data, error } = await supabase
    .from("unidades")
    .select("id, nome")
    .eq("clinica_id", clienteId);

  if (error) {
    return {
      erro: `Não deu para conferir as unidades do cliente: ${error.message}`,
    };
  }

  const doCliente = new Set((data ?? []).map((u) => u.id));
  const forasteiras = unidadeIds.filter((id) => !doCliente.has(id));

  if (forasteiras.length > 0) {
    return {
      erro: "Só dá para escolher unidades deste cliente. Para a pessoa atender em outro cliente, cadastre-a lá.",
    };
  }

  return {
    ids: unidadeIds,
    nomes: new Map(
      (data ?? []).map((u) => [u.id, (u.nome ?? "").trim() || "esta unidade"]),
    ),
  };
}

/**
 * Regrava onde a pessoa atende — e na ordem que não deixa ninguém sem lugar.
 *
 * Insere o que entrou antes de apagar o que saiu, de propósito: o Supabase não
 * junta as duas gravações numa transação, e apagar primeiro faria um erro no
 * meio deixar a pessoa sem unidade nenhuma. Sem unidade ela fica sem cliente,
 * fora de todas as fichas, e sem caminho de volta pela tela. Nesta ordem, o
 * pior caso é sobrar um lugar a mais — visível, e corrigível no mesmo lugar.
 *
 * Quem já estava e continua não é apagado e reinserido, só tem o horário
 * regravado. A diferença importa: apagar e reinserir passaria pela chave
 * estrangeira duas vezes por nada, e qualquer coisa que um dia venha a pendurar
 * no vínculo se perderia numa edição de nome.
 *
 * Desmarcar um lugar e marcar de novo, porém, apaga o horário dele — o vínculo
 * antigo foi embora de verdade. É o comportamento que a tela mostra: o bloco de
 * horário desaparece junto com a marca e volta em branco.
 *
 * Devolve o motivo da falha, ou nada.
 */
async function trocarUnidades(
  supabase: ClienteDoServidor,
  profissionalId: number,
  unidadeIds: number[],
  horarios: Map<number, HorarioGravavel>,
) {
  const { data: atuais, error } = await supabase
    .from("profissional_unidades")
    .select("unidade_id")
    .eq("profissional_id", profissionalId);

  if (error) {
    return `Os dados foram salvos, mas os lugares não: ${error.message}`;
  }

  const tinha = new Set((atuais ?? []).map((v) => v.unidade_id));
  const entraram = unidadeIds.filter((id) => !tinha.has(id));
  const sairam = [...tinha].filter((id) => !unidadeIds.includes(id));

  if (entraram.length > 0) {
    const { error: erroAoEntrar } = await supabase
      .from("profissional_unidades")
      .insert(
        entraram.map((unidade_id) => ({
          profissional_id: profissionalId,
          unidade_id,
          ...SEM_HORARIO,
          ...horarios.get(unidade_id),
        })),
      );

    if (erroAoEntrar) {
      return `Os dados foram salvos, mas os lugares não: ${erroAoEntrar.message}`;
    }
  }

  if (sairam.length > 0) {
    const { error: erroAoSair } = await supabase
      .from("profissional_unidades")
      .delete()
      .eq("profissional_id", profissionalId)
      .in("unidade_id", sairam);

    if (erroAoSair) {
      return `Os dados foram salvos, e a pessoa entrou nos lugares novos, mas os antigos não saíram: ${erroAoSair.message}`;
    }
  }

  // Uma gravação por lugar que continuou. São um, dois ou três por pessoa — um
  // `update` por linha custa menos do que montar um `upsert` que precisaria
  // repetir a chave inteira e correria o risco de criar vínculo em vez de
  // corrigir horário.
  const continuaram = unidadeIds.filter((id) => tinha.has(id));

  for (const unidade_id of continuaram) {
    const { error: erroDoHorario } = await supabase
      .from("profissional_unidades")
      .update({ ...SEM_HORARIO, ...horarios.get(unidade_id) })
      .eq("profissional_id", profissionalId)
      .eq("unidade_id", unidade_id);

    if (erroDoHorario) {
      return `Os dados e os lugares foram salvos, mas o horário não: ${erroDoHorario.message}`;
    }
  }

  return null;
}

/**
 * A área de atuação do cliente, que vira a área de quem atende nele.
 *
 * O formulário do profissional não pergunta isso: quem atende numa clínica de
 * odontologia é da área de odontologia, e repetir o campo em cada pessoa seria
 * pedir a mesma resposta várias vezes. A coluna `tipo` no banco é obrigatória
 * e travada na mesma lista, então o valor vem daqui já conferido.
 */
async function areaDoCliente(
  supabase: ClienteDoServidor,
  clienteId: number,
): Promise<{ erro: string } | { area_atuacao: string }> {
  const { data, error } = await supabase
    .from("clinicas")
    .select("area_atuacao")
    .eq("id", clienteId)
    .single();

  if (error || !data) {
    return {
      erro: `não deu para ler o cliente (${error?.message ?? "cliente não encontrado"})`,
    };
  }

  const area = (data.area_atuacao ?? "").trim();

  if (!(tiposDeProfissional as readonly string[]).includes(area)) {
    return {
      erro: "este cliente está sem área de atuação. Edite o cliente e informe a área antes de cadastrar quem atende nele",
    };
  }

  return { area_atuacao: area };
}

/**
 * Grava a pessoa e as ligações dela. Devolve o motivo da falha, ou nada.
 *
 * São três gravações — a pessoa, os procedimentos e os lugares — e o Supabase
 * não as junta numa transação. Se uma ligação falhar, o profissional é apagado
 * (o `on delete cascade` leva junto o que já tinha entrado) e nada fica pela
 * metade. Sem isso, um erro no meio deixaria alguém cadastrado sem lugar
 * nenhum, com cara de cadastro concluído.
 */
async function gravarPessoa(
  supabase: ClienteDoServidor,
  pessoa: DadosDaPessoa,
  area: string,
  unidadeIds: number[],
  horarios: Map<number, HorarioGravavel>,
) {
  const { data: criado, error } = await supabase
    .from("profissionais")
    .insert({
      nome: pessoa.nome,
      nome_exibicao: pessoa.nome_exibicao,
      especialidade_principal: pessoa.especialidade_principal,
      procedimento_outro: pessoa.procedimento_outro,
      registro: pessoa.registro,
      ativo: pessoa.ativo,
      tipo: area,
    })
    .select("id")
    .single();

  if (error || !criado) {
    return `o profissional não entrou (${error?.message ?? "o banco não devolveu o cadastro"})`;
  }

  const erroDasLigacoes = await ligar(supabase, criado.id, {
    especialidadeIds: pessoa.especialidadeIds,
    unidadeIds,
    horarios,
  });

  if (!erroDasLigacoes) return null;

  const { error: erroAoDesfazer } = await supabase
    .from("profissionais")
    .delete()
    .eq("id", criado.id);

  if (erroAoDesfazer) {
    return `${erroDasLigacoes}, e não deu para desfazer: o profissional nº ${criado.id} ficou gravado sem as ligações`;
  }

  return erroDasLigacoes;
}

/** Grava as duas listas de ligação. Devolve o motivo da primeira falha, ou nada. */
async function ligar(
  supabase: ClienteDoServidor,
  profissionalId: number,
  ligacoes: {
    especialidadeIds: number[];
    unidadeIds: number[];
    horarios: Map<number, HorarioGravavel>;
  },
) {
  if (ligacoes.especialidadeIds.length > 0) {
    const { error } = await supabase.from("profissional_especialidades").insert(
      ligacoes.especialidadeIds.map((especialidade_id) => ({
        profissional_id: profissionalId,
        especialidade_id,
      })),
    );
    if (error) return `não deu para gravar os procedimentos (${error.message})`;
  }

  const { error } = await supabase.from("profissional_unidades").insert(
    ligacoes.unidadeIds.map((unidade_id) => ({
      profissional_id: profissionalId,
      unidade_id,
      ...SEM_HORARIO,
      ...ligacoes.horarios.get(unidade_id),
    })),
  );
  if (error) return `não deu para gravar os lugares (${error.message})`;

  return null;
}
