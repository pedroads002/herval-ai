"use server";

/**
 * A gravação do perfil de quem está logado.
 *
 * Existe porque o painel assina o que a pessoa faz — tarefa criada à mão, nota
 * no Atendimento, mensagem do CRC e movimentação de etapa no Funil — e, sem
 * perfil, a assinatura caía no e-mail do login. "equipehervalmarketing@gmail.com
 * marcou a tarefa" é verdade, mas não é o nome de ninguém.
 *
 * O id vem da sessão, nunca da tela: é ele que diz de quem é a linha. A política
 * do banco prende a gravação a `auth.uid()`, então uma tela que mandasse outro
 * id seria recusada pelo Postgres — mas o id nem chega a sair daqui.
 */

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/acoes/etapaDoLead";
import { conferirPerfil, type NovoPerfil } from "@/lib/dados/perfilDoUsuario";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

export async function salvarPerfil(
  entrada: NovoPerfil,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) {
    return { ok: false, mensagem: sessao.erro, envio: Date.now() };
  }

  const conferida = conferirPerfil(entrada);
  if ("erro" in conferida) {
    return { ok: false, mensagem: conferida.erro, envio: Date.now() };
  }

  const { data: usuario } = await sessao.supabase.auth.getUser();
  const email = usuario.user?.email ?? "";

  // Upsert, e não update: quem já estava cadastrado antes do gatilho não tem
  // linha de perfil, e um update sem linha grava zero e não reclama — a tela
  // diria "salvo" sem nada ter sido salvo.
  const { error } = await sessao.supabase.from("profiles").upsert({
    id: sessao.usuarioId,
    nome: conferida.linha.nome,
    sobrenome:
      conferida.linha.sobrenome === "" ? null : conferida.linha.sobrenome,
    email,
  });

  if (error) {
    return {
      ok: false,
      mensagem: `O perfil não foi salvo: ${error.message}`,
      envio: Date.now(),
    };
  }

  // O nome aparece no cabeçalho de todas as telas do painel, não só na de
  // Perfil — por isso a revalidação é do layout inteiro.
  revalidatePath("/", "layout");

  return {
    ok: true,
    mensagem: "Perfil salvo. É este nome que vai assinar o que você gravar.",
    envio: Date.now(),
  };
}
