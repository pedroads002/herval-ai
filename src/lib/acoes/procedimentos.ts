"use server";

/**
 * As gravações do catálogo de procedimentos.
 *
 *   cadastrarProcedimento  entra um procedimento novo no catálogo da agência.
 *   editarProcedimento     nome, duração e se está ativo.
 *   excluirProcedimento    só quando ninguém realiza — ver abaixo.
 *
 * Grava em `especialidades`, que é como a tabela se chama no banco. A palavra da
 * tela é "procedimento".
 *
 * A conferência de sessão está aqui dentro, e não só no proxy, pelo mesmo motivo
 * das ações de Clientes: uma ação de servidor é um endereço POST como outro
 * qualquer, e o proxy protege a *tela*. Quem chamasse isto direto não passaria
 * por tela nenhuma.
 */

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

const LIMITE_NOME = 120;

/**
 * Os limites de duração.
 *
 * Quarenta minutos é o padrão da coluna e o que os 23 procedimentos já
 * cadastrados usam. O teto de oito horas não é sobre o que é razoável, e sim
 * sobre o que é dígito errado: quem digita 400 em vez de 40 precisa ouvir isso
 * antes de a Agenda tentar encaixar seis horas e meia na tarde de alguém.
 */
const DURACAO_MINIMA = 5;
const DURACAO_MAXIMA = 480;

type ClienteDoServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(mensagem: string): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now() };
}

async function exigirSessao(): Promise<
  { erro: string } | { supabase: ClienteDoServidor }
> {
  if (!supabaseConfigurado()) {
    return { erro: "O Supabase não está configurado neste ambiente." };
  }

  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { erro: "Sua sessão expirou. Entre de novo para gravar." };
  }

  return { supabase };
}

function numero(formData: FormData, campo: string) {
  const n = Number(String(formData.get(campo) ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

type DadosDoProcedimento = {
  nome: string;
  duracao_minutos: number;
  ativa: boolean;
};

function lerProcedimento(
  formData: FormData,
): { erro: string } | DadosDoProcedimento {
  const nome = String(formData.get("nome") ?? "").trim();
  const duracao = numero(formData, "duracao_minutos");

  if (nome === "") return { erro: "O nome do procedimento é obrigatório." };
  if (nome.length > LIMITE_NOME) {
    return { erro: `O nome passou de ${LIMITE_NOME} caracteres.` };
  }

  if (duracao === null) {
    return { erro: "Informe a duração em minutos." };
  }

  if (duracao < DURACAO_MINIMA || duracao > DURACAO_MAXIMA) {
    return {
      erro: `A duração tem que ficar entre ${DURACAO_MINIMA} e ${DURACAO_MAXIMA} minutos.`,
    };
  }

  return {
    nome,
    duracao_minutos: duracao,
    ativa: formData.get("ativa") !== null,
  };
}

/**
 * Procura outro procedimento com o mesmo nome.
 *
 * O banco não tem índice único em `nome`, e acrescentar um agora exigiria uma
 * migração num catálogo que já está em uso. A conferência aqui resolve o caso
 * que acontece de verdade — duas pessoas cadastrando "Botox" na mesma semana —
 * e não finge ser tranca de concorrência: duas gravações no mesmo instante
 * ainda passariam. O estrago disso é nome repetido na lista, não dado perdido.
 *
 * `ilike` sem curinga compara o texto inteiro ignorando maiúsculas, que é como
 * uma pessoa lê nome repetido.
 */
async function nomeJaUsado(
  supabase: ClienteDoServidor,
  nome: string,
  exceto: number | null,
) {
  let consulta = supabase
    .from("especialidades")
    .select("id, nome")
    .ilike("nome", nome);

  if (exceto !== null) consulta = consulta.neq("id", exceto);

  const { data, error } = await consulta;

  if (error) return `Não deu para conferir o nome: ${error.message}`;
  if ((data ?? []).length === 0) return null;

  return `Já existe um procedimento chamado "${nome}" no catálogo.`;
}

export async function cadastrarProcedimento(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const dados = lerProcedimento(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const repetido = await nomeJaUsado(sessao.supabase, dados.nome, null);
  if (repetido) return recusar(repetido);

  const { error } = await sessao.supabase.from("especialidades").insert(dados);

  if (error) return recusar(`Não deu para cadastrar: ${error.message}`);

  revalidatePath("/especialidades");
  revalidatePath("/clientes");
  return aceitar(`${dados.nome} entrou no catálogo.`);
}

export async function editarProcedimento(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) {
    return recusar("Não deu para saber qual procedimento editar.");
  }

  const dados = lerProcedimento(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const repetido = await nomeJaUsado(sessao.supabase, dados.nome, id);
  if (repetido) return recusar(repetido);

  const { error } = await sessao.supabase
    .from("especialidades")
    .update(dados)
    .eq("id", id);

  if (error) return recusar(`Não deu para salvar: ${error.message}`);

  revalidatePath("/especialidades");
  revalidatePath("/clientes");
  return aceitar("Alterações salvas.");
}

/**
 * Apaga um procedimento do catálogo — e recusa quando alguém realiza.
 *
 * A recusa não é zelo excessivo: `profissional_especialidades` tem
 * `on delete cascade` para `especialidades`. Apagar um procedimento que dez
 * pessoas realizam tiraria o procedimento da ficha das dez, em silêncio, sem
 * nada na tela dizendo que aconteceu. Desativar dá o resultado que a pessoa
 * quer — a Helô para de oferecer — sem mexer em cadastro de ninguém.
 *
 * O caminho que sobra é o que existe de verdade: procedimento cadastrado por
 * engano, que ninguém realiza ainda, sai do catálogo.
 */
export async function excluirProcedimento(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) {
    return recusar("Não deu para saber qual procedimento excluir.");
  }

  const { data: quemRealiza, error: erroDaEquipe } = await sessao.supabase
    .from("profissional_especialidades")
    .select("profissional_id")
    .eq("especialidade_id", id);

  if (erroDaEquipe) {
    return recusar(`Não deu para excluir: ${erroDaEquipe.message}`);
  }

  const quantos = (quemRealiza ?? []).length;

  if (quantos > 0) {
    return recusar(
      quantos === 1
        ? "Uma pessoa realiza este procedimento, e apagá-lo o tiraria da ficha dela. Para a Helô parar de oferecer, desative o procedimento."
        : `${quantos} pessoas realizam este procedimento, e apagá-lo o tiraria da ficha delas. Para a Helô parar de oferecer, desative o procedimento.`,
    );
  }

  const { error } = await sessao.supabase
    .from("especialidades")
    .delete()
    .eq("id", id);

  // A chave estrangeira de `leads` não tem cascade: um lead que chegou
  // interessado neste procedimento impede a exclusão pelo banco, e o motivo
  // chega aqui como erro. Traduzir é melhor que repassar "violates foreign key".
  if (error) {
    return recusar(
      "Não deu para excluir: algum lead chegou interessado neste procedimento, e apagá-lo apagaria esse histórico. Desative o procedimento em vez de excluir.",
    );
  }

  revalidatePath("/especialidades");
  revalidatePath("/clientes");
  return aceitar("Procedimento excluído.");
}
