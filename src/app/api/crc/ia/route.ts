import { NextResponse } from "next/server";
import { carregarPerfil } from "@/lib/perfil";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { IA_PAUSADA, horaDaPausa, iaEstaPausada } from "@/lib/pausaDaIa";

/**
 * Pausa ou reativa o atendimento da Helô num lead.
 *
 * **Quem assina não vem do formulário**, pelo mesmo motivo da rota de notas: o
 * navegador manda só o lead e o que fazer, e o nome de quem pausou sai da
 * sessão aqui no servidor. É esse nome que aparece no Log, e nome de assinatura
 * que o cliente pode escolher é assinatura que não vale nada.
 *
 * Grava com o cliente da sessão, e não com chave de serviço, para a RLS de
 * `leads` continuar valendo de verdade.
 *
 * O que esta rota **não** faz: calar a Helô. Hoje nenhum node do cérebro lê
 * `leads.atendimento_ia` para decidir se responde — o freio é a parte 2 desta
 * seção, no n8n. Até ela ser publicada, o botão registra a decisão e o Log
 * mostra quem tomou, mas a IA continua respondendo. Está dito aqui porque é
 * exatamente o tipo de coisa que, esquecida, viraria "o botão está quebrado".
 */

type Pedido = { leadId?: unknown; pausar?: unknown };

function recusar(motivo: string, status: number) {
  return NextResponse.json({ gravado: false, motivo }, { status });
}

export async function POST(request: Request) {
  if (!supabaseConfigurado()) {
    return recusar("O Supabase não está configurado neste ambiente.", 503);
  }

  const perfil = await carregarPerfil();
  if (!perfil) {
    return recusar("Sua sessão expirou. Entre de novo para continuar.", 401);
  }

  let pedido: Pedido;
  try {
    pedido = (await request.json()) as Pedido;
  } catch {
    return recusar("Pedido malformado.", 400);
  }

  const leadId = Number(pedido.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return recusar("Lead inválido.", 400);
  }

  // Booleano de verdade, e não "qualquer coisa que pareça sim": um pedido com
  // `pausar: "false"` cairia como verdadeiro num teste de verdade frouxo, e
  // pausaria o atendimento de alguém que pediu o contrário.
  if (typeof pedido.pausar !== "boolean") {
    return recusar("Não deu para saber se é para pausar ou reativar.", 400);
  }
  const pausar = pedido.pausar;

  const supabase = await criarClienteServidor();

  // Reativar limpa o autor e a data de propósito: deixar lá quem pausou na vez
  // anterior faria a tela dizer "pausada por" sobre uma pausa que já terminou.
  const quando = new Date().toISOString();
  const mudanca = pausar
    ? {
        atendimento_ia: IA_PAUSADA,
        ia_pausada_em: quando,
        ia_pausada_por: perfil.nomeCompleto,
      }
    : { atendimento_ia: null, ia_pausada_em: null, ia_pausada_por: null };

  const { data: gravado, error } = await supabase
    .from("leads")
    .update(mudanca)
    .eq("id", leadId)
    .select("atendimento_ia, ia_pausada_em, ia_pausada_por")
    .maybeSingle();

  if (error) {
    return recusar(`Não deu para gravar: ${error.message}`, 422);
  }

  // Zero linhas com `error` nulo é o caso perigoso deste update: a RLS ou um id
  // inexistente devolvem sucesso sem ter mudado nada. Sem esta conferência o
  // botão trocaria de estado na tela e o banco continuaria como estava.
  if (!gravado) {
    return recusar(
      "Este lead não foi encontrado no banco, então não há o que pausar.",
      404,
    );
  }

  const pausada = iaEstaPausada(gravado.atendimento_ia);

  return NextResponse.json({
    gravado: true,
    iaPausada: pausada,
    pausa:
      pausada && gravado.ia_pausada_em
        ? {
            por: (gravado.ia_pausada_por ?? "").trim() || "Equipe",
            minutosAtras: 0,
            horas: horaDaPausa(gravado.ia_pausada_em),
          }
        : null,
  });
}
