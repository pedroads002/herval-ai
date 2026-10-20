"use server";

/**
 * As gravações do banco de objeções.
 *
 *   cadastrarObjecao  entra uma objeção nova, com resposta padrão e uso zero.
 *   editarObjecao     o texto da objeção e da resposta.
 *   excluirObjecao    tira do banco, sem recorte: nada referencia esta
 *                     tabela por chave estrangeira, e `usos` é só contexto
 *                     para quem revisa o roteiro, não histórico que precise
 *                     sobreviver à linha.
 *
 * Grava em `objecoes`, protegida por RLS só para `eh_herval_admin()`: é
 * roteiro da agência, compartilhado entre clientes, não dado de uma clínica —
 * por isso não há `lead_na_operacao` nem `clinica_id` aqui, diferente das
 * outras ações deste diretório.
 *
 * O Supervisor1 (prompt do n8n) lê esta mesma tabela direto no SQL. Estas
 * ações não tocam no workflow: mudou o texto aqui, a próxima vez que o
 * n8n ler o banco já vê a mudança, sem precisar publicar nada de novo lá.
 */

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { Objecao } from "@/data/objecoes";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

const LIMITE_OBJECAO = 160;
const LIMITE_RESPOSTA = 600;

type ClienteDoServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(mensagem: string, objecao?: Objecao): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now(), objecao };
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

type DadosDaObjecao = { objecao: string; resposta: string };

function lerObjecao(formData: FormData): { erro: string } | DadosDaObjecao {
  const objecao = String(formData.get("objecao") ?? "").trim();
  const resposta = String(formData.get("resposta") ?? "").trim();

  if (objecao === "" || resposta === "") {
    return { erro: "Preencha a objeção e a resposta padrão." };
  }
  if (objecao.length > LIMITE_OBJECAO) {
    return { erro: `A objeção passou de ${LIMITE_OBJECAO} caracteres.` };
  }
  if (resposta.length > LIMITE_RESPOSTA) {
    return { erro: `A resposta passou de ${LIMITE_RESPOSTA} caracteres.` };
  }

  return { objecao, resposta };
}

export async function cadastrarObjecao(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const dados = lerObjecao(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const { data, error } = await sessao.supabase
    .from("objecoes")
    .insert({ ...dados, usos: 0 })
    .select("id, objecao, resposta, usos")
    .single();

  if (error) return recusar(`Não deu para cadastrar: ${error.message}`);

  revalidatePath("/objecoes");
  return aceitar("Objeção cadastrada.", data as Objecao);
}

export async function editarObjecao(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual objeção editar.");

  const dados = lerObjecao(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const { error } = await sessao.supabase
    .from("objecoes")
    .update(dados)
    .eq("id", id);

  if (error) return recusar(`Não deu para salvar: ${error.message}`);

  revalidatePath("/objecoes");
  return aceitar("Alterações salvas.");
}

export async function excluirObjecao(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual objeção excluir.");

  const { error } = await sessao.supabase
    .from("objecoes")
    .delete()
    .eq("id", id);

  if (error) return recusar(`Não deu para excluir: ${error.message}`);

  revalidatePath("/objecoes");
  return aceitar("Objeção excluída.");
}
