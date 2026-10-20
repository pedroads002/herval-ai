/**
 * A via de leitura dos textos de follow-up (régua de automação).
 *
 * `follow_up_mensagens` guarda o texto de cada "bolha" que o n8n manda quando
 * o lead fica sem responder — sete etapas (F1 a F7), normalmente três bolhas
 * cada, em `ordem`. `clinica_id` nulo é o texto padrão; linha de uma clínica
 * substituiria o padrão daquela etapa, mas hoje não existe nenhuma: todas as
 * 21 linhas são padrão. Esta tela só lê e grava nas linhas padrão — override
 * por clínica não é o que foi pedido aqui.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

export type EtapaDeFollowUp = "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";

export const ETAPAS_DE_FOLLOW_UP: EtapaDeFollowUp[] = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
];

export type MensagemFollowUp = {
  id: number;
  etapa: EtapaDeFollowUp;
  ordem: number;
  texto: string;
  delaySegundos: number;
};

type LinhaDeFollowUp = {
  id: number;
  etapa: string;
  ordem: number;
  delay_segundos: number;
  texto: string;
};

const CAMPOS_DO_FOLLOW_UP = "id, etapa, ordem, delay_segundos, texto";

export type DadosDoFollowUp = {
  /** As mensagens padrão, já agrupadas por etapa e em ordem. */
  porEtapa: Record<EtapaDeFollowUp, MensagemFollowUp[]>;
  falha: string | null;
};

function etapaValida(valor: string): EtapaDeFollowUp {
  return (ETAPAS_DE_FOLLOW_UP as string[]).includes(valor)
    ? (valor as EtapaDeFollowUp)
    : "F1";
}

function linhaParaMensagem(linha: LinhaDeFollowUp): MensagemFollowUp {
  return {
    id: linha.id,
    etapa: etapaValida(linha.etapa),
    ordem: linha.ordem,
    texto: linha.texto,
    delaySegundos: linha.delay_segundos,
  };
}

function grupoVazio(): Record<EtapaDeFollowUp, MensagemFollowUp[]> {
  return { F1: [], F2: [], F3: [], F4: [], F5: [], F6: [], F7: [] };
}

export async function carregarFollowUp(): Promise<DadosDoFollowUp> {
  if (!supabaseConfigurado()) {
    return {
      porEtapa: grupoVazio(),
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("follow_up_mensagens")
    .select(CAMPOS_DO_FOLLOW_UP)
    .is("clinica_id", null)
    .order("etapa", { ascending: true })
    .order("ordem", { ascending: true });

  if (error) {
    return {
      porEtapa: grupoVazio(),
      falha: `Não deu para ler os textos de follow-up: ${error.message}`,
    };
  }

  const porEtapa = grupoVazio();
  for (const linha of data as LinhaDeFollowUp[]) {
    porEtapa[etapaValida(linha.etapa)].push(linhaParaMensagem(linha));
  }

  return { porEtapa, falha: null };
}
