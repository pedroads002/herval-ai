"use server";

/**
 * A gravação da decisão da Fila de Tarefas: Aprovar, Rejeitar, Avisar CRC.
 *
 * Até aqui clicar nesses botões mexia só na memória do navegador —
 * `definirStatus` em `ProvedorLeads.tsx` trocava o estado e recarregar a página
 * desfazia. Para uma fila de trabalho isso é pior que não ter botão: o CRC
 * marca "avisado", sai da tela, e no dia seguinte a tarefa está pendente de
 * novo sem ninguém ter desfeito nada.
 *
 * `decidido_em` vai junto com o status porque o banco não aceita os dois
 * separados: o CHECK `tarefas_decisao_coerente` exige data nula enquanto
 * Pendente e data preenchida em qualquer outra decisão. É esse campo que vai
 * permitir medir tempo de resposta do CRC depois.
 *
 * Recebe argumentos soltos, e não `FormData`, porque quem chama é um botão da
 * tabela e não um formulário — o mesmo caminho de `acoes/funil.ts`.
 */

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/acoes/etapaDoLead";
import { conferirDecisao } from "@/lib/dados/linhaDeTarefa";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

export async function decidirTarefa(
  tarefaId: number,
  status: string,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const decisao = conferirDecisao(tarefaId, status);
  if ("erro" in decisao) return recusar(decisao.erro);

  const { error } = await sessao.supabase
    .from("tarefas")
    .update({
      status: decisao.status,
      decidido_em:
        decisao.status === "Pendente" ? null : new Date().toISOString(),
    })
    .eq("id", tarefaId);

  if (error) {
    return recusar(`A decisão não foi gravada: ${error.message}`);
  }

  // A fila é a tela inicial do painel.
  revalidatePath("/");

  return {
    ok: true,
    mensagem:
      decisao.status === "Pendente"
        ? "Tarefa devolvida para pendente."
        : `Tarefa marcada como "${decisao.status}".`,
    envio: Date.now(),
  };
}
