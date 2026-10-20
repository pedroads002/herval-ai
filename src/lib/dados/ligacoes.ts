/**
 * A via de leitura das ligações de um lead.
 *
 * A tabela existe e já está protegida por RLS, mas quem grava nela ainda não
 * existe: o registro de tentativa depende da integração com a API de
 * telefonia/WhatsApp, que ainda não chegou. Até lá, esta função sempre volta
 * uma lista vazia de verdade (não fixture) — é o estado real da operação
 * hoje, e não um placeholder.
 *
 * O banco guarda `criado_em` (quando a tentativa aconteceu, hora cheia); a
 * tela trabalha em "há quanto tempo" (`minutosAtras`), como todo o resto da
 * base — ver `lib/tempo.ts`. A conversão é feita aqui, na leitura, e não
 * gravada: gravar minuto decorrido junto com o registro o deixaria errado
 * minuto a minuto depois de salvo.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { canaisDeLigacao, type Ligacao } from "@/data/ligacoes";

type LinhaDeLigacao = {
  id: number;
  lead_id: number;
  canal: string;
  tentativa: number;
  desfecho: string;
  criado_em: string;
};

const CAMPOS_DA_LIGACAO = "id, lead_id, canal, tentativa, desfecho, criado_em";

/**
 * Canal desconhecido não deveria existir — o CHECK da tabela impede — mas se
 * vier, cai em "discador" em vez de quebrar a tela.
 */
function canalValido(valor: string): Ligacao["canal"] {
  return (canaisDeLigacao as string[]).includes(valor)
    ? (valor as Ligacao["canal"])
    : "discador";
}

function linhaParaLigacao(linha: LinhaDeLigacao): Ligacao {
  const minutosAtras = Math.round(
    (Date.now() - new Date(linha.criado_em).getTime()) / 60000,
  );
  return {
    id: linha.id,
    leadId: linha.lead_id,
    canal: canalValido(linha.canal),
    tentativa: linha.tentativa,
    minutosAtras: Math.max(0, minutosAtras),
    desfecho: linha.desfecho === "atendida" ? "atendida" : "não atendida",
  };
}

/**
 * As ligações de um lead só — o Atendimento mostra o histórico dele sem
 * carregar a base inteira. Mesmo padrão de `carregarConsultasDoLead`.
 */
export async function carregarLigacoesDoLead(
  leadId: number,
): Promise<Ligacao[]> {
  if (!supabaseConfigurado() || !Number.isInteger(leadId) || leadId <= 0) {
    return [];
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("ligacoes")
    .select(CAMPOS_DA_LIGACAO)
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: true });

  if (error || !data) return [];

  return (data as LinhaDeLigacao[]).map(linhaParaLigacao);
}
