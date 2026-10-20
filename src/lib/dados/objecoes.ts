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
 * As mais usadas primeiro: é a lista que mais ajuda quem está revisando o
 * roteiro. Dentro do mesmo `usos`, pela ordem de cadastro.
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
    .order("usos", { ascending: false })
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
