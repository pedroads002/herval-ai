/**
 * A via de leitura do Funil.
 *
 * Até aqui esta tela lia um arquivo fixo no código — e esse arquivo estava
 * vazio, então o quadro mostrava dezesseis colunas em branco para todo mundo,
 * enquanto os leads de verdade estavam no banco. Mover um card mexia só na
 * memória do navegador e recarregar a página desfazia o movimento.
 *
 * Por que um módulo separado, e não uma troca dentro de `src/data/`: pelo mesmo
 * motivo de `dados/atendimento.ts`. Os arquivos de `src/data/` alimentam Visão
 * Geral, Relatórios e Fila de Tarefas ao mesmo tempo, e o banco não tem o que
 * aquelas telas pedem — score, prazo, regra disparada, ligação. Trocar a fonte lá
 * embaixo obrigaria a inventar esses campos para elas continuarem de pé, e número
 * inventado num relatório é pior que relatório fictício declarado. Então o recorte
 * é explícito: só o Funil lê daqui, e o que ele mostra existe de verdade.
 *
 * O que ficou de fora do card, e por quê: "IA / Humano" e o destaque de alerta
 * humano. Não são informação do lead, são informação da Fila de Tarefas — não
 * existem em `leads` e não teriam como existir sem alguém escolher um valor
 * plausível. Um selo desses mentindo com cara de dado real é pior que selo
 * nenhum.
 *
 * A conversão de cada linha em card mora em `linhaDoFunil.ts`, onde pode ser
 * conferida sem sessão nem banco.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import {
  montarLeadDoFunil,
  type LeadDoFunil,
  type LinhaDeLead,
} from "@/lib/dados/linhaDoFunil";

export type { LeadDoFunil };

export type DadosDoFunil = {
  leads: LeadDoFunil[];
  falha: string | null;
  aviso: string | null;
};

/** Ver o mesmo raciocínio em `dados/agenda.ts`. */
const TETO_DE_LINHAS = 1000;

const SEM_DADOS: DadosDoFunil = { leads: [], falha: null, aviso: null };

const CAMPOS_DO_LEAD =
  "id, nome, telefone, etapa, origem, criado_em, motivo_perda, clinica_id";

export async function carregarFunil(): Promise<DadosDoFunil> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  // As três leituras não dependem uma da outra.
  const [respostaDosLeads, respostaDasFaltas, respostaDosClientes] =
    await Promise.all([
      supabase
        .from("leads")
        .select(CAMPOS_DO_LEAD)
        .order("criado_em", { ascending: false })
        .limit(TETO_DE_LINHAS),
      // A remarcação não é um contador guardado: é a quantidade de faltas que o
      // lead tem em `agendamentos`. Contador solto é o que começa a discordar do
      // que de fato aconteceu.
      supabase
        .from("agendamentos")
        .select("lead_id")
        .eq("status", "Faltou")
        .limit(TETO_DE_LINHAS),
      supabase.from("clinicas").select("id, nome").limit(TETO_DE_LINHAS),
    ]);

  const erro =
    respostaDosLeads.error ??
    respostaDasFaltas.error ??
    respostaDosClientes.error;

  if (erro) {
    return { ...SEM_DADOS, falha: `Não deu para ler o funil: ${erro.message}` };
  }

  const linhas = (respostaDosLeads.data ?? []) as LinhaDeLead[];

  const faltas = new Map<number, number>();
  for (const { lead_id } of (respostaDasFaltas.data ?? []) as {
    lead_id: number;
  }[]) {
    faltas.set(lead_id, (faltas.get(lead_id) ?? 0) + 1);
  }

  const clientes = new Map<number, string>();
  for (const cliente of (respostaDosClientes.data ?? []) as {
    id: number;
    nome: string | null;
  }[]) {
    clientes.set(cliente.id, (cliente.nome ?? "").trim() || "Sem nome");
  }

  const contexto = { hoje: new Date(), clientes, faltas };

  const leads: LeadDoFunil[] = [];
  const foraDoQuadro = new Set<string>();

  for (const linha of linhas) {
    const lead = montarLeadDoFunil(linha, contexto);

    // Etapa que o quadro não tem coluna para desenhar. O lead não é descartado
    // em silêncio: ele fica de fora do quadro e o aviso diz que ficou, porque
    // lead que desaparece da tela sem explicação é o pior dos dois casos.
    if (lead === null) {
      foraDoQuadro.add(linha.etapa);
      continue;
    }

    leads.push(lead);
  }

  return {
    leads,
    falha: null,
    aviso: montarAviso(linhas.length, foraDoQuadro),
  };
}

function montarAviso(lidos: number, foraDoQuadro: Set<string>) {
  const avisos: string[] = [];

  if (lidos >= TETO_DE_LINHAS) {
    avisos.push(
      `O quadro está mostrando no máximo ${TETO_DE_LINHAS} leads, os mais recentes. Nada foi perdido no banco, mas esta lista não está completa.`,
    );
  }

  if (foraDoQuadro.size > 0) {
    const nomes = [...foraDoQuadro].map((nome) => `"${nome}"`).join(", ");
    avisos.push(
      `Há lead em etapa que o funil não tem: ${nomes}. Esses leads não aparecem no quadro até a etapa deles ser corrigida.`,
    );
  }

  return avisos.length > 0 ? avisos.join(" ") : null;
}
