/**
 * Quem respondeu à clínica.
 *
 * "Respondeu" é o lead ter escrito depois da primeira mensagem da clínica. A
 * primeira fala do lead não conta sozinha: quem chega pelo anúncio já abre a
 * conversa com um "oi", e aí todo lead teria "respondido".
 *
 * Mensagem da clínica é a da IA, da equipe ou automática (follow-up, lembrete,
 * template). As notas internas "Trava…" e "Erro…" ficam de fora: são gravadas
 * como mensagem automática, mas nunca chegam ao lead.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { lerEmPaginas } from "@/lib/dados/pacientes";

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

export type LinhaDeMensagemParaResposta = {
  lead_id: number;
  remetente_tipo: string;
  regra: string | null;
  criado_em: string;
};

const REMETENTES_DA_CLINICA = ["IA", "Humano", "Automática"];
const NOTA_INTERNA = /^(Trava|Erro)/;

/** As linhas precisam vir em ordem de `criado_em`, da mais antiga para a mais nova. */
export function idsQueResponderam(
  linhas: LinhaDeMensagemParaResposta[],
): Set<number> {
  const clinicaJaFalou = new Set<number>();
  const responderam = new Set<number>();

  for (const linha of linhas) {
    if (linha.remetente_tipo === "Lead") {
      if (clinicaJaFalou.has(linha.lead_id)) responderam.add(linha.lead_id);
      continue;
    }
    if (
      REMETENTES_DA_CLINICA.includes(linha.remetente_tipo) &&
      !NOTA_INTERNA.test(linha.regra ?? "")
    ) {
      clinicaJaFalou.add(linha.lead_id);
    }
  }

  return responderam;
}

/**
 * Lê as mensagens em páginas e devolve os ids de quem respondeu.
 *
 * `desde` corta pela data da mensagem. Serve quando a tela só olha leads que
 * chegaram a partir dali: nenhuma mensagem desses leads é anterior à chegada.
 */
export async function lerQuemRespondeu(
  supabase: Supabase,
  desde?: string,
): Promise<{ ids: Set<number>; erro: string | null; cortado: boolean }> {
  const lidas = await lerEmPaginas<LinhaDeMensagemParaResposta>(
    (de, ate) => {
      let consulta = supabase
        .from("mensagens")
        .select("lead_id, remetente_tipo, regra, criado_em");
      if (desde !== undefined) consulta = consulta.gte("criado_em", desde);
      return consulta
        .order("criado_em", { ascending: true })
        .order("id", { ascending: true })
        .range(de, ate);
    },
    100_000,
  );

  return {
    ids: idsQueResponderam(lidas.linhas),
    erro: lidas.erro,
    cortado: lidas.cortado,
  };
}
