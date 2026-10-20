"use server";

/**
 * As gravações dos textos de follow-up (régua de automação).
 *
 *   cadastrarMensagemFollowUp  entra uma bolha nova ao final de uma etapa.
 *                              `ordem` é calculada aqui, nunca recebida do
 *                              cliente: duas pessoas adicionando ao mesmo
 *                              tempo não podem colidir na mesma posição.
 *   editarMensagemFollowUp     o texto e a espera (`delay_segundos`) de uma
 *                              bolha existente. Etapa e ordem não mudam por
 *                              aqui — reordenar não foi pedido nesta volta.
 *   excluirMensagemFollowUp    tira a bolha do banco, sem recorte: nada
 *                              referencia esta linha por chave estrangeira, e
 *                              o texto de uma mensagem já enviada a um lead
 *                              não depende de a linha continuar existindo.
 *
 * Grava só nas linhas padrão (`clinica_id is null`) — ver `lib/dados/followUp.ts`.
 * Protegida por RLS (`somente_herval`, `eh_herval_admin()`), igual `objecoes`.
 *
 * O n8n lê esta mesma tabela direto no SQL. Estas ações não tocam no
 * workflow: mudou o texto aqui, a próxima vez que o n8n ler o banco já vê a
 * mudança, sem precisar publicar nada de novo lá.
 */

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import {
  ETAPAS_DE_FOLLOW_UP,
  type EtapaDeFollowUp,
  type MensagemFollowUp,
} from "@/data/followUp";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

const LIMITE_TEXTO = 1200;
const ESPERA_MINIMA = 0;
const ESPERA_MAXIMA = 60;

type ClienteDoServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(
  mensagem: string,
  mensagemFollowUp?: MensagemFollowUp,
): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now(), mensagemFollowUp };
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

function etapaDoFormulario(formData: FormData): EtapaDeFollowUp | null {
  const etapa = String(formData.get("etapa") ?? "").trim();
  return (ETAPAS_DE_FOLLOW_UP as string[]).includes(etapa)
    ? (etapa as EtapaDeFollowUp)
    : null;
}

type DadosDaMensagem = { texto: string; delay_segundos: number };

function lerMensagem(formData: FormData): { erro: string } | DadosDaMensagem {
  const texto = String(formData.get("texto") ?? "").trim();
  const espera = Number(String(formData.get("delay_segundos") ?? "").trim());

  if (texto === "") return { erro: "Preencha o texto da mensagem." };
  if (texto.length > LIMITE_TEXTO) {
    return { erro: `O texto passou de ${LIMITE_TEXTO} caracteres.` };
  }
  if (
    !Number.isInteger(espera) ||
    espera < ESPERA_MINIMA ||
    espera > ESPERA_MAXIMA
  ) {
    return {
      erro: `A espera precisa ser um número inteiro entre ${ESPERA_MINIMA} e ${ESPERA_MAXIMA} segundos.`,
    };
  }

  return { texto, delay_segundos: espera };
}

export async function cadastrarMensagemFollowUp(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const etapa = etapaDoFormulario(formData);
  if (!etapa) return recusar("Não deu para saber a etapa desta mensagem.");

  const dados = lerMensagem(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const { data: maiorOrdem, error: erroDeLeitura } = await sessao.supabase
    .from("follow_up_mensagens")
    .select("ordem")
    .is("clinica_id", null)
    .eq("etapa", etapa)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroDeLeitura) {
    return recusar(`Não deu para calcular a ordem: ${erroDeLeitura.message}`);
  }

  const proximaOrdem = (maiorOrdem?.ordem ?? 0) + 1;

  const { data, error } = await sessao.supabase
    .from("follow_up_mensagens")
    .insert({ etapa, ordem: proximaOrdem, ...dados })
    .select("id, etapa, ordem, delay_segundos, texto")
    .single();

  if (error) return recusar(`Não deu para cadastrar: ${error.message}`);

  revalidatePath("/regua-automacao");
  return aceitar("Mensagem adicionada.", {
    id: data.id,
    etapa,
    ordem: data.ordem,
    texto: data.texto,
    delaySegundos: data.delay_segundos,
  });
}

export async function editarMensagemFollowUp(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual mensagem editar.");

  const dados = lerMensagem(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const { error } = await sessao.supabase
    .from("follow_up_mensagens")
    .update(dados)
    .eq("id", id);

  if (error) return recusar(`Não deu para salvar: ${error.message}`);

  revalidatePath("/regua-automacao");
  return aceitar("Alterações salvas.");
}

export async function excluirMensagemFollowUp(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual mensagem excluir.");

  const { error } = await sessao.supabase
    .from("follow_up_mensagens")
    .delete()
    .eq("id", id);

  if (error) return recusar(`Não deu para excluir: ${error.message}`);

  revalidatePath("/regua-automacao");
  return aceitar("Mensagem excluída.");
}
