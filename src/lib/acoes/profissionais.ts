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

  const erro = await gravarPessoa(sessao.supabase, pessoa, dados.area_atuacao, [
    cliente.unidades[0].id,
  ]);

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

  const unidadeIds = numeros(formData, "unidades");
  if (unidadeIds.length === 0) {
    return recusar("Marque pelo menos um lugar onde a pessoa atende.");
  }

  const area = await areaDoCliente(sessao.supabase, clienteId);
  if ("erro" in area) return recusar(area.erro);

  const erro = await gravarPessoa(
    sessao.supabase,
    pessoa,
    area.area_atuacao,
    unidadeIds,
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

  const pessoa = lerPessoa(formData);
  if ("erro" in pessoa) return recusar(pessoa.erro);

  const erro = await salvarPessoa(sessao.supabase, id, pessoa, null);
  if (erro) return recusar(erro);

  const clienteId = numero(formData, "cliente");
  revalidatePath("/clientes");
  if (clienteId !== null) revalidatePath(`/clientes/${clienteId}`);
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
  ligacoes: { especialidadeIds: number[]; unidadeIds: number[] },
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
    })),
  );
  if (error) return `não deu para gravar os lugares (${error.message})`;

  return null;
}
