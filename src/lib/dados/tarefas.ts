/**
 * A via de leitura da Fila de Tarefas.
 *
 * Até aqui esta tela lia `tarefasIniciais`, um array vazio no código — então a
 * fila aparecia zerada mesmo quando o cérebro da Helô já tinha sinalizado algo
 * para o CRC. O que ele sinaliza hoje (as três travas de atendimento e os dois
 * casos de clínica sem instância de WhatsApp) ficava só em `mensagens`,
 * misturado com a conversa do lead, de onde ninguém consegue responder "o que
 * está aberto agora".
 *
 * A tabela `tarefas` é de 06/10/2026 (`supabase/fila-de-tarefas.sql`). Ela
 * nasce vazia: até o n8n passar a gravar nela, esta leitura devolve lista vazia
 * e a tela mostra a fila zerada — com a diferença de que agora é a fila de
 * verdade, e uma linha inserida à mão aparece.
 *
 * Por que módulo separado, e não uma troca dentro de `src/data/`: o mesmo
 * motivo de `dados/funil.ts`. Os arquivos de `src/data/` descrevem o formato;
 * a fonte do dado é escolhida aqui, onde há sessão e banco.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { OpcaoDeLead, Tarefa } from "@/data/tarefas";
import type { LinhaDeLead } from "@/lib/dados/linhaDoFunil";
import { montarTarefa, type LinhaDeTarefa } from "@/lib/dados/linhaDeTarefa";

export type DadosDaFila = {
  tarefas: Tarefa[];
  /**
   * Os leads que o formulário de criar tarefa oferece.
   *
   * Saem desta mesma leitura, e não de uma consulta própria: os leads já são
   * lidos aqui para montar a tarefa, então a lista não custa nenhuma ida extra
   * ao banco. Lista separada também discordaria da fila na hora em que um lead
   * fosse apagado.
   */
  leads: OpcaoDeLead[];
  falha: string | null;
  aviso: string | null;
};

/** Ver o mesmo raciocínio em `dados/agenda.ts`. */
const TETO_DE_LINHAS = 1000;

const SEM_DADOS: DadosDaFila = {
  tarefas: [],
  leads: [],
  falha: null,
  aviso: null,
};

const CAMPOS_DA_TAREFA =
  "id, lead_id, tipo, regra, acao_sugerida, status, prazo_em_minutos, criado_em, decidido_em, prazo_em, descricao, atribuido_a, criado_por, motivo_devolucao";

const CAMPOS_DO_LEAD =
  "id, nome, telefone, etapa, origem, criado_em, motivo_perda, clinica_id";

export async function carregarFilaDeTarefas(): Promise<DadosDaFila> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  // As três leituras não dependem uma da outra.
  const [respostaDasTarefas, respostaDosLeads, respostaDosClientes] =
    await Promise.all([
      supabase
        .from("tarefas")
        .select(CAMPOS_DA_TAREFA)
        // A mais nova primeiro. A ordem de urgência é da tela, que agrupa por
        // prazo; esta ordem só decide quem sobrevive ao teto de linhas.
        .order("criado_em", { ascending: false })
        .limit(TETO_DE_LINHAS),
      supabase.from("leads").select(CAMPOS_DO_LEAD).limit(TETO_DE_LINHAS),
      supabase.from("clinicas").select("id, nome").limit(TETO_DE_LINHAS),
    ]);

  const erro =
    respostaDasTarefas.error ??
    respostaDosLeads.error ??
    respostaDosClientes.error;

  if (erro) {
    return { ...SEM_DADOS, falha: `Não deu para ler a fila: ${erro.message}` };
  }

  const linhas = (respostaDasTarefas.data ?? []) as LinhaDeTarefa[];

  const leads = new Map<number, LinhaDeLead>();
  for (const lead of (respostaDosLeads.data ?? []) as LinhaDeLead[]) {
    leads.set(lead.id, lead);
  }

  const clientes = new Map<number, string>();
  for (const cliente of (respostaDosClientes.data ?? []) as {
    id: number;
    nome: string | null;
  }[]) {
    clientes.set(cliente.id, (cliente.nome ?? "").trim() || "Sem nome");
  }

  const contexto = { agora: new Date(), leads, clientes };

  const opcoesDeLead: OpcaoDeLead[] = [...leads.values()]
    .map((lead) => ({
      id: lead.id,
      nome: (lead.nome ?? "").trim() || "Lead sem nome",
      telefone: (lead.telefone ?? "").trim(),
      cliente:
        lead.clinica_id === null
          ? null
          : (clientes.get(lead.clinica_id) ?? null),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const tarefas: Tarefa[] = [];
  let foraDaFila = 0;

  for (const linha of linhas) {
    const tarefa = montarTarefa(linha, contexto);
    if (tarefa === null) {
      foraDaFila += 1;
      continue;
    }
    tarefas.push(tarefa);
  }

  return {
    tarefas,
    leads: opcoesDeLead,
    falha: null,
    aviso: montarAviso(linhas.length, foraDaFila),
  };
}

function montarAviso(lidas: number, foraDaFila: number) {
  const avisos: string[] = [];

  if (lidas >= TETO_DE_LINHAS) {
    avisos.push(
      `A fila está mostrando no máximo ${TETO_DE_LINHAS} tarefas, as mais recentes. Nada foi perdido no banco, mas esta lista não está completa.`,
    );
  }

  // Tarefa que não pôde ser desenhada: lead apagado, etapa que o funil não tem,
  // ou tipo/status fora da lista. Ela não desaparece em silêncio.
  if (foraDaFila > 0) {
    avisos.push(
      foraDaFila === 1
        ? "Há 1 tarefa que não aparece na fila: o lead dela foi apagado, ou a etapa, o tipo ou o status estão fora das listas do sistema."
        : `Há ${foraDaFila} tarefas que não aparecem na fila: o lead delas foi apagado, ou a etapa, o tipo ou o status estão fora das listas do sistema.`,
    );
  }

  return avisos.length > 0 ? avisos.join(" ") : null;
}
