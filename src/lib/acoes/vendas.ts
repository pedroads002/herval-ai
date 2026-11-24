"use server";

/**
 * As vendas do lead: ler, registrar, corrigir e apagar.
 *
 * O Funil e o Atendimento chamam as mesmas quatro ações, pelo mesmo motivo de
 * `MenuDeEtapa`: as duas telas mexem no mesmo lead, e regra repetida é regra que
 * passa a valer só onde alguém lembrou de repetir.
 *
 * Registrar uma venda leva o lead para "Venda Ganha" quando ele ainda não está
 * lá — vendeu, ganhou. A venda é gravada primeiro: se ela falhar, o lead não
 * muda de etapa, e "Venda Ganha" nunca aparece sem uma venda que a explique.
 * Corrigir ou apagar não mexe na etapa: isso continua sendo decisão de quem
 * move o card.
 *
 * O isolamento entre clínicas é do RLS de `vendas` (ver `supabase/vendas.sql`):
 * uma sessão de cliente não lê nem grava venda de lead de outra operação, por
 * mais que a tela mande outro id.
 */

import { revalidatePath } from "next/cache";
import { exigirSessao, moverEtapaDoLead } from "@/lib/acoes/etapaDoLead";
import { especialidadesDaClinica } from "@/lib/dados/atendimento";
import {
  CAMPOS_DA_VENDA,
  conferirVenda,
  montarVenda,
  type LinhaDeVenda,
  type VendaDoFormulario,
  type VendaDoLead,
} from "@/lib/dados/linhaDeVenda";
import { ETAPA_GANHA } from "@/data/leads";

export type VendasDoLead = {
  vendas: VendaDoLead[];
  /** Sugestões para o campo de procedimento: o que a clínica atende. */
  procedimentos: string[];
  /** As formas de pagamento que a clínica cadastrou na Estratégia. */
  formasPagamento: string[];
  falha: string | null;
};

export type ResultadoDaVenda = {
  ok: boolean;
  mensagem: string;
  envio: number;
  /** Presente quando a venda foi gravada, mas a etapa não pôde mudar. */
  aviso?: string;
};

function recusar(mensagem: string): ResultadoDaVenda {
  return { ok: false, mensagem, envio: Date.now() };
}

function revalidarTelas(leadId: number) {
  revalidatePath("/funil");
  revalidatePath(`/atendimento/${leadId}`);
  revalidatePath("/visao-geral");
}

export async function carregarVendasDoLead(
  leadId: number,
): Promise<VendasDoLead> {
  const vazio: VendasDoLead = {
    vendas: [],
    procedimentos: [],
    formasPagamento: [],
    falha: null,
  };

  const sessao = await exigirSessao();
  if ("erro" in sessao) return { ...vazio, falha: sessao.erro };
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return { ...vazio, falha: "Lead inválido." };
  }

  const { data: lead, error: erroDoLead } = await sessao.supabase
    .from("leads")
    .select("clinica_id")
    .eq("id", leadId)
    .maybeSingle();

  if (erroDoLead || !lead) {
    return { ...vazio, falha: "Não deu para encontrar este lead." };
  }

  const [respostaVendas, respostaClinica, respostaProcedimentos] =
    await Promise.all([
      sessao.supabase
        .from("vendas")
        .select(CAMPOS_DA_VENDA)
        .eq("lead_id", leadId)
        .order("data_venda", { ascending: false })
        .order("id", { ascending: false }),
      lead.clinica_id === null
        ? Promise.resolve({ data: null, error: null })
        : sessao.supabase
            .from("clinicas")
            .select("formas_pagamento")
            .eq("id", lead.clinica_id)
            .maybeSingle(),
      especialidadesDaClinica(sessao.supabase, lead.clinica_id),
    ]);

  if (respostaVendas.error) {
    return {
      ...vazio,
      falha: `Não deu para ler as vendas: ${respostaVendas.error.message}`,
    };
  }

  const formas = (
    (respostaClinica.data as { formas_pagamento: string[] | null } | null)
      ?.formas_pagamento ?? []
  ).filter((f) => typeof f === "string" && f.trim() !== "");

  const procedimentos = [
    ...new Set((respostaProcedimentos.data ?? []).map((e) => e.nome)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    vendas: ((respostaVendas.data ?? []) as LinhaDeVenda[]).map(montarVenda),
    procedimentos,
    formasPagamento: formas,
    falha: null,
  };
}

export async function salvarVenda(
  dados: VendaDoFormulario,
): Promise<ResultadoDaVenda> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const conferida = conferirVenda(dados);
  if ("erro" in conferida) return recusar(conferida.erro);
  const { id, ...campos } = conferida.venda;

  if (id !== null) {
    // Corrigir: a venda continua no mesmo lead. O `eq("lead_id")` impede que um
    // id de venda trocado na tela corrija a venda de outro lead.
    const { data, error } = await sessao.supabase
      .from("vendas")
      .update(campos)
      .eq("id", id)
      .eq("lead_id", campos.lead_id)
      .select("id");

    if (error) return recusar(`A venda não foi corrigida: ${error.message}`);
    if (!data || data.length === 0) {
      return recusar("Esta venda não existe mais, ou não é deste lead.");
    }

    revalidarTelas(campos.lead_id);
    return { ok: true, mensagem: "Venda corrigida.", envio: Date.now() };
  }

  const { error: erroDaVenda } = await sessao.supabase.from("vendas").insert({
    ...campos,
    registrado_por: sessao.usuarioId,
    registrado_por_nome: sessao.usuarioNome,
  });

  if (erroDaVenda) {
    return recusar(`A venda não foi registrada: ${erroDaVenda.message}`);
  }

  // Vendeu, ganhou. `moverEtapaDoLead` não grava nada quando o lead já está em
  // "Venda Ganha", então a segunda venda do mesmo paciente não suja o histórico.
  const aviso = await moverEtapaDoLead(
    sessao,
    campos.lead_id,
    ETAPA_GANHA,
  );

  revalidarTelas(campos.lead_id);

  return {
    ok: true,
    mensagem: "Venda registrada.",
    envio: Date.now(),
    ...(aviso ? { aviso: `A venda foi registrada, mas: ${aviso}` } : {}),
  };
}

export async function apagarVenda(
  vendaId: number,
  leadId: number,
): Promise<ResultadoDaVenda> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);
  if (!Number.isInteger(vendaId) || vendaId <= 0) {
    return recusar("Venda inválida.");
  }

  const { data, error } = await sessao.supabase
    .from("vendas")
    .delete()
    .eq("id", vendaId)
    .eq("lead_id", leadId)
    .select("id");

  if (error) return recusar(`A venda não foi apagada: ${error.message}`);
  if (!data || data.length === 0) {
    return recusar("Esta venda não existe mais, ou não é deste lead.");
  }

  revalidarTelas(leadId);
  return { ok: true, mensagem: "Venda apagada.", envio: Date.now() };
}
