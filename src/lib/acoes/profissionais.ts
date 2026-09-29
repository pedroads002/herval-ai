"use server";

/**
 * As gravações da seção Profissionais — **a primeira parte do painel que escreve
 * num cadastro.** Até aqui ele só escrevia conversa: nota e mensagem.
 *
 * São três, e as três servem a um fluxo só, que começa numa pergunta: a pessoa
 * atende sozinha ou tem equipe?
 *
 *   cadastrarAutonomo    quem atende sozinho. Cliente e profissional na mesma
 *                        ação, com o mesmo nome, porque são a mesma pessoa.
 *   cadastrarCliente     a clínica, quando existe equipe. Primeiro passo.
 *   cadastrarProfissional cada pessoa da equipe. Repetido quantas vezes precisar.
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
import type {
  ClienteCriado,
  ResultadoDoCadastro,
} from "@/lib/acoes/resultadoDoCadastro";

const LIMITE_NOME = 120;
const LIMITE_REGISTRO = 60;

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

/** Os campos da pessoa, conferidos. Valem para os dois caminhos do fluxo. */
type DadosDaPessoa = {
  nome: string;
  tipo: string;
  registro: string | null;
  especialidadeIds: number[];
};

function lerPessoa(formData: FormData): { erro: string } | DadosDaPessoa {
  const nome = texto(formData, "nome");
  const tipo = texto(formData, "tipo");
  const registro = texto(formData, "registro");

  if (nome === "") return { erro: "O nome do profissional é obrigatório." };
  if (nome.length > LIMITE_NOME) {
    return { erro: `O nome passou de ${LIMITE_NOME} caracteres.` };
  }
  // A mesma lista que trava a coluna no banco. Conferir aqui é o que produz
  // uma frase em português em vez do erro cru do CHECK.
  if (!(tiposDeProfissional as readonly string[]).includes(tipo)) {
    return { erro: "Escolha o tipo do profissional." };
  }
  if (registro.length > LIMITE_REGISTRO) {
    return { erro: `O registro passou de ${LIMITE_REGISTRO} caracteres.` };
  }

  return {
    nome,
    tipo,
    // Vazio vira nulo, e não texto vazio: "não tem conselho de classe" e
    // "tem, mas ninguém digitou" viram a mesma coisa se os dois forem "".
    registro: registro === "" ? null : registro,
    especialidadeIds: numeros(formData, "especialidades"),
  };
}

/**
 * Grava uma linha em `clinicas` e devolve ela já com a unidade.
 *
 * A primeira unidade não é criada aqui: existe um gatilho no banco que a cria
 * junto, com o mesmo nome do cliente. Duplicar isso no painel daria duas
 * unidades para quem cadastrasse por aqui e uma para quem cadastrasse por fora.
 *
 * `numero_unidades` é preenchido com 1 porque é o que o gatilho acabou de
 * fazer. A coluna é um número digitado à mão, que já convive com a contagem
 * real das unidades — deixá-la em zero com uma unidade existindo seria criar a
 * contradição no momento do cadastro.
 *
 * Se o gatilho não tiver criado a unidade, o cliente é apagado e o cadastro
 * falha. Cliente sem unidade nenhuma é um cliente onde ninguém pode ser
 * encaixado: entregá-lo assim seria entregar um cadastro que não serve.
 */
async function criarCliente(
  supabase: ClienteDoServidor,
  nome: string,
): Promise<{ erro: string } | { cliente: ClienteCriado }> {
  const { data: criado, error } = await supabase
    .from("clinicas")
    .insert({ nome, numero_unidades: 1 })
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
      nome: criado.nome ?? nome,
      unidades: unidades.map((u) => ({ id: u.id, nome: u.nome ?? nome })),
    },
  };
}

/**
 * Passo um do caminho "tem equipe": a clínica.
 *
 * Só o nome. Quem atende ali é cadastrado na sequência, na mesma tela, com a
 * unidade que voltou daqui já escolhida.
 */
export async function cadastrarCliente(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const nome = texto(formData, "nome");

  if (nome === "") return recusar("O nome do cliente é obrigatório.");
  if (nome.length > LIMITE_NOME) {
    return recusar(`O nome passou de ${LIMITE_NOME} caracteres.`);
  }

  const resultado = await criarCliente(sessao.supabase, nome);
  if ("erro" in resultado) return recusar(`Não deu: ${resultado.erro}.`);

  revalidatePath("/profissionais");
  return aceitar(
    `Cliente "${resultado.cliente.nome}" cadastrado, já com a primeira unidade.`,
    resultado.cliente,
  );
}

/**
 * O caminho "atende sozinho": cliente e profissional numa gravação só.
 *
 * O nome é pedido uma vez e serve aos dois. Quem atende sozinho *é* o cliente —
 * pedir "nome da clínica" e "nome do profissional" separados para a mesma
 * pessoa seria inventar uma clínica que não existe e fazer quem cadastra
 * digitar o próprio nome duas vezes.
 *
 * Não há campo de unidade: a única unidade é a que o gatilho cria junto com o
 * cliente, e é nela que a pessoa é encaixada.
 *
 * São quatro gravações e o Supabase não as junta numa transação. Qualquer falha
 * depois da primeira apaga o cliente, e o `on delete cascade` leva unidade e
 * vínculos junto. Meio cadastro é pior que nenhum: ficaria um cliente vazio na
 * lista, com cara de cliente de verdade.
 */
export async function cadastrarAutonomo(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const pessoa = lerPessoa(formData);
  if ("erro" in pessoa) return recusar(pessoa.erro);

  const resultado = await criarCliente(sessao.supabase, pessoa.nome);
  if ("erro" in resultado) return recusar(`Não deu: ${resultado.erro}.`);

  const { cliente } = resultado;

  const erro = await gravarPessoa(sessao.supabase, pessoa, [
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

  revalidatePath("/profissionais");
  return aceitar(`${pessoa.nome} cadastrado, atendendo por conta própria.`);
}

/**
 * Cada pessoa da equipe, uma por vez.
 *
 * O cliente já existe quando esta ação roda — foi criado no passo anterior do
 * fluxo, ou já estava cadastrado. O que chega aqui é em qual unidade dele a
 * pessoa atende.
 */
export async function cadastrarProfissional(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const pessoa = lerPessoa(formData);
  if ("erro" in pessoa) return recusar(pessoa.erro);

  const unidadeIds = numeros(formData, "unidades");
  if (unidadeIds.length === 0) {
    return recusar("Marque pelo menos um lugar onde a pessoa atende.");
  }

  const erro = await gravarPessoa(sessao.supabase, pessoa, unidadeIds);
  if (erro) return recusar(`Não deu para cadastrar: ${erro}`);

  revalidatePath("/profissionais");
  return aceitar(`${pessoa.nome} cadastrado.`);
}

/**
 * Grava a pessoa e as ligações dela. Devolve o motivo da falha, ou nada.
 *
 * São três gravações — a pessoa, as especialidades e os lugares — e o Supabase
 * não as junta numa transação. Se uma ligação falhar, o profissional é apagado
 * (o `on delete cascade` leva junto o que já tinha entrado) e nada fica pela
 * metade. Sem isso, um erro no meio deixaria alguém cadastrado sem lugar
 * nenhum, com cara de cadastro concluído.
 */
async function gravarPessoa(
  supabase: ClienteDoServidor,
  pessoa: DadosDaPessoa,
  unidadeIds: number[],
) {
  const { data: criado, error } = await supabase
    .from("profissionais")
    .insert({ nome: pessoa.nome, tipo: pessoa.tipo, registro: pessoa.registro })
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
    if (error)
      return `não deu para gravar as especialidades (${error.message})`;
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
