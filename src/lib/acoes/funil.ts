"use server";

/**
 * A gravação do Funil: mover o lead de etapa pelo menu do card.
 *
 * Até aqui mover mexia só na memória do navegador. Agora grava `leads.etapa`, e a
 * mudança vira linha em `lead_etapa_eventos`, assinada por quem está logado — o
 * mesmo caminho que a Agenda já usa, porque é o mesmo módulo:
 * `acoes/etapaDoLead.ts`.
 *
 * Recebe argumentos soltos, e não `FormData`, porque quem chama é um botão dentro
 * do card e não um formulário. Isso não muda a desconfiança: a etapa e o motivo
 * são conferidos por `conferirMovimento` contra as listas fechadas antes de
 * qualquer gravação.
 */

import { revalidatePath } from "next/cache";
import { exigirSessao, moverEtapaDoLead } from "@/lib/acoes/etapaDoLead";
import { conferirMovimento } from "@/lib/dados/linhaDoFunil";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

export async function moverLeadDeEtapa(
  leadId: number,
  destino: string,
  motivoPerda: string | null,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const movimento = conferirMovimento(leadId, destino, motivoPerda);
  if ("erro" in movimento) return recusar(movimento.erro);

  const aviso = await moverEtapaDoLead(
    sessao,
    leadId,
    movimento.etapa,
    movimento.motivo,
  );

  revalidatePath("/funil");
  // A etapa do lead é o que a Agenda usa para saber quem está esperando horário.
  revalidatePath("/agenda");

  // O aviso vem quando a gravação não passou, ou quando a etapa mudou e o
  // histórico não registrou. `moverEtapaDoLead` nunca lança: ele explica.
  if (aviso !== null) return recusar(aviso);

  return {
    ok: true,
    mensagem: `Lead movido para "${movimento.etapa}".`,
    envio: Date.now(),
  };
}
