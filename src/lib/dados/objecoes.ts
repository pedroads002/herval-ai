/**
 * A via de leitura do banco de objeções.
 *
 * Tabela da própria agência (RLS só para `eh_herval_admin()`), compartilhada
 * entre todos os clientes: é o roteiro de resposta que a Helô e o CRC usam
 * quando um lead levanta uma objeção. O Supervisor1 (prompt do n8n) já lê
 * esta mesma tabela direto no SQL — ver o nó `Contexto e Travas` do workflow
 * "Helô - base". Esta tela só ganha a mesma leitura e passa a gravar nela.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { Objecao } from "@/data/objecoes";

type LinhaDeObjecao = {
  id: number;
  objecao: string;
  resposta: string;
  usos: number;
};

const CAMPOS_DA_OBJECAO = "id, objecao, resposta, usos";

export type DadosDasObjecoes = {
  objecoes: Objecao[];
  /** Por que a tela está vazia, quando estiver — ver o mesmo raciocínio em `dados/procedimentos.ts`. */
  falha: string | null;
};

function linhaParaObjecao(linha: LinhaDeObjecao): Objecao {
  return {
    id: linha.id,
    objecao: linha.objecao,
    resposta: linha.resposta,
    usos: linha.usos,
  };
}

/**
 * Pela ordem de cadastro. Já foi "as mais usadas primeiro", mas `usos` nunca
 * chegou a ser contagem de verdade: ninguém registra o uso de uma objeção —
 * quem usa é a Helô ou o CRC, na conversa, e isso não volta para o banco. Os
 * números que existiam vieram do dado de exemplo, então a ordem que eles
 * produziam também era inventada. Volta a ordenar por `usos` no dia em que o
 * n8n passar a registrar qual objeção foi usada.
 */
export async function carregarObjecoes(): Promise<DadosDasObjecoes> {
  if (!supabaseConfigurado()) {
    return {
      objecoes: [],
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("objecoes")
    .select(CAMPOS_DA_OBJECAO)
    .order("id", { ascending: true });

  if (error) {
    return {
      objecoes: [],
      falha: `Não deu para ler as objeções: ${error.message}`,
    };
  }

  return {
    objecoes: (data as LinhaDeObjecao[]).map(linhaParaObjecao),
    falha: null,
  };
}
