/**
 * A via de leitura da tela de Atendimento — a primeira parte do painel que lê
 * o banco em vez de arquivo fixo.
 *
 * Por que um módulo separado, e não uma troca dentro de `src/data/`: os
 * arquivos de `src/data/` alimentam Funil, Agenda, Relatórios e Fila de
 * Tarefas ao mesmo tempo, e o banco hoje não tem o que aquelas telas pedem
 * (ligação, agendamento, score, prazo). Trocar a fonte lá embaixo obrigaria a
 * inventar esses campos para as outras telas continuarem de pé — e dado
 * inventado num relatório é pior que relatório fictício declarado.
 *
 * Então o recorte é explícito: só o Atendimento lê daqui, e o que ele mostra
 * existe de verdade.
 *
 * Roda apenas no servidor. Quem chama são os componentes de servidor das rotas
 * `/atendimento` e `/atendimento/[id]`.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { etapasFunil, type EtapaFunil } from "@/data/leads";
import {
  tiposDeRemetente,
  type FormatoMensagem,
  type Mensagem,
  type StatusEntrega,
  type TipoRemetente,
} from "@/data/mensagens";

/**
 * Um lead da tela de Atendimento.
 *
 * É de propósito menor que `Tarefa`: tem só o que esta tela mostra e o banco
 * sabe responder. `Tarefa` carrega regra, ação, score e prazo, que não existem
 * em `leads` — preencher aqueles campos com valor plausível faria a tela
 * mentir com cara de dado real.
 */
export type LeadEmAtendimento = {
  id: number;
  lead: string;
  /** Formatado para leitura: "(51) 96146-8628". */
  telefone: string;
  /**
   * O telefone como está gravado, incluindo o sufixo do WhatsApp.
   *
   * Existe separado porque é ele que vai no envio: a conferência do lado do
   * n8n compara só os dígitos, e o telefone bonito perde o código do país
   * ("(51) 9…" normaliza sem o 55 na frente e não bate com o que está no
   * banco). Quem endereça é o banco; isto aqui é o que o n8n usa para conferir.
   */
  telefoneBruto: string;
  clinicaId: number | null;
  nomeDaClinica: string;
  etapa: EtapaFunil;
  origem: string;
  /** Há quantos minutos o lead chegou, na convenção de `lib/tempo.ts`. */
  minutosAtras: number;
};

/**
 * Uma mensagem da conversa.
 *
 * É apelido de `Mensagem`, e não um formato próprio, porque as colunas de
 * `mensagens` no banco foram desenhadas contra esse tipo: os três CHECK da
 * tabela (`remetente_tipo`, `formato`, `status`) listam exatamente os mesmos
 * valores. Escrever o formato de novo aqui criaria duas definições do mesmo
 * fato, livres para divergir sem ninguém notar — o contrário da disciplina do
 * projeto. O nome existe só para dizer, em quem lê a tela, de onde o dado vem.
 */
export type MensagemEmAtendimento = Mensagem;

/** Uma nota interna do CRC. */
export type NotaEmAtendimento = {
  id: number;
  leadId: number;
  autor: string;
  minutosAtras: number;
  texto: string;
};

export type DadosDoAtendimento = {
  leads: LeadEmAtendimento[];
  mensagens: MensagemEmAtendimento[];
  notas: NotaEmAtendimento[];
  /**
   * Por que a tela pode estar vazia, quando estiver. Distingue "não há
   * conversa nenhuma" de "não consegui ler o banco" — sem isso as duas
   * situações viram a mesma tela em branco, e a segunda é um defeito.
   */
  falha: string | null;
};

const SEM_DADOS: DadosDoAtendimento = {
  leads: [],
  mensagens: [],
  notas: [],
  falha: null,
};

/** Milissegundos desde um instante, em minutos. Nunca negativo. */
function minutosDesde(iso: string, agora: number) {
  const quando = Date.parse(iso);
  if (Number.isNaN(quando)) return 0;
  return Math.max(0, Math.round((agora - quando) / 60_000));
}

/**
 * "5551961468628@s.whatsapp.net" vira "(51) 96146-8628".
 *
 * O banco guarda o identificador do WhatsApp como ele chega, e é isso que o
 * envio usa. Aqui é só a leitura: o CRC precisa reconhecer o número, não o
 * formato interno do protocolo.
 *
 * A máscara só é aplicada quando o código do país 55 está presente. Sem essa
 * condição, um número de fora com onze dígitos — 14155551234, dos Estados
 * Unidos — virava "(14) 15555-1234": um telefone que não existe, com cara de
 * telefone certo. Mostrar os dígitos crus é feio; mostrar o número errado é
 * defeito, porque o CRC liga para ele.
 *
 * Todo identificador do WhatsApp chega com código de país, então o caminho
 * bonito é o caminho normal — o cru é a exceção.
 */
export function telefoneLegivel(bruto: string) {
  const digitos = (bruto ?? "").replace(/\D/g, "");
  if (!digitos.startsWith("55")) return digitos;

  const nacional = digitos.slice(2);

  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return digitos;
}

/**
 * `leads.etapa` é texto livre no banco, e o Funil trabalha com uma lista
 * fechada de dezesseis colunas. Texto que não é nenhuma delas cai em "Leads
 * Recebidos" — a etapa de quem acabou de chegar e ninguém classificou ainda.
 *
 * A alternativa era descartar o lead, e ela foi rejeitada: um lead sumir da
 * tela de atendimento por causa de um texto estranho na etapa é pior que
 * aparecer na primeira coluna.
 */
function etapaConhecida(valor: string | null): EtapaFunil {
  const etapa = (valor ?? "").trim();
  return (etapasFunil as string[]).includes(etapa)
    ? (etapa as EtapaFunil)
    : "Leads Recebidos";
}

function remetenteConhecido(valor: string | null): TipoRemetente {
  const tipo = (valor ?? "").trim();
  return (tiposDeRemetente as string[]).includes(tipo)
    ? (tipo as TipoRemetente)
    : "Lead";
}

const formatos: FormatoMensagem[] = ["texto", "audio", "imagem", "video"];

function formatoConhecido(valor: string | null): FormatoMensagem {
  const formato = (valor ?? "").trim();
  return (formatos as string[]).includes(formato)
    ? (formato as FormatoMensagem)
    : "texto";
}

const statusValidos: StatusEntrega[] = ["enviada", "entregue", "lida"];

function statusConhecido(valor: string | null): StatusEntrega | undefined {
  const status = (valor ?? "").trim();
  return (statusValidos as string[]).includes(status)
    ? (status as StatusEntrega)
    : undefined;
}

type LinhaLead = {
  id: number;
  nome: string | null;
  telefone: string | null;
  clinica_id: number | null;
  etapa: string | null;
  origem: string | null;
  criado_em: string;
};

type LinhaMensagem = {
  id: number;
  lead_id: number;
  remetente_tipo: string | null;
  remetente_nome: string | null;
  formato: string | null;
  texto: string | null;
  regra: string | null;
  status: string | null;
  criado_em: string;
};

type LinhaNota = {
  id: number;
  lead_id: number;
  autor_nome: string | null;
  texto: string;
  criado_em: string;
};

/**
 * Carrega a tela de Atendimento inteira: os leads, a conversa de cada um e as
 * notas.
 *
 * **Todo lead com mensagem aparece, inclusive quem mandou uma só e não foi
 * respondido.** Essa é a diferença que a operação pediu: a trava 2 do cérebro
 * manda a Helô ficar calada na primeiríssima mensagem justamente para um
 * humano responder — se a tela só mostrasse conversa já em andamento, esse
 * lead ficaria invisível exatamente no momento em que ele é urgente.
 *
 * Também aparece lead sem mensagem nenhuma: ele chegou e ninguém falou com
 * ele, o que é a fila mais antiga que existe.
 *
 * As três consultas vão juntas em vez de uma por lead. A conversa é varrida
 * uma vez e indexada na tela, como já era com o dado de exemplo.
 */
export async function carregarAtendimento(): Promise<DadosDoAtendimento> {
  if (!supabaseConfigurado()) {
    return { ...SEM_DADOS, falha: "O Supabase não está configurado neste ambiente." };
  }

  const supabase = await criarClienteServidor();

  const [respostaLeads, respostaMensagens, respostaNotas, respostaClinicas] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, nome, telefone, clinica_id, etapa, origem, criado_em")
        .order("criado_em", { ascending: false }),
      supabase
        .from("mensagens")
        .select(
          "id, lead_id, remetente_tipo, remetente_nome, formato, texto, regra, status, criado_em",
        )
        .order("criado_em", { ascending: true }),
      supabase
        .from("notas")
        .select("id, lead_id, autor_nome, texto, criado_em")
        .order("criado_em", { ascending: false }),
      supabase.from("clinicas").select("id, nome"),
    ]);

  // Leads e mensagens são a tela. Se qualquer uma das duas falhar, é melhor
  // dizer que não deu para ler do que mostrar meia conversa como se fosse a
  // conversa toda.
  const erro = respostaLeads.error ?? respostaMensagens.error;
  if (erro) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler as conversas: ${erro.message}`,
    };
  }

  // Notas e clínicas não seguram a tela. Se a tabela de notas ainda não tiver
  // sido criada no banco, a conversa continua aparecendo sem elas.
  const nomesDeClinica = new Map<number, string>(
    (respostaClinicas.data ?? []).map((c) => [c.id as number, String(c.nome)]),
  );

  const agora = Date.now();

  const leads = ((respostaLeads.data ?? []) as LinhaLead[]).map((linha) => {
    const bruto = linha.telefone ?? "";
    return {
      id: linha.id,
      lead: (linha.nome ?? "").trim() || "Sem nome",
      telefone: telefoneLegivel(bruto),
      telefoneBruto: bruto,
      clinicaId: linha.clinica_id,
      nomeDaClinica:
        (linha.clinica_id !== null ? nomesDeClinica.get(linha.clinica_id) : null) ??
        "Clínica não informada",
      etapa: etapaConhecida(linha.etapa),
      origem: (linha.origem ?? "").trim() || "Origem não informada",
      minutosAtras: minutosDesde(linha.criado_em, agora),
    } satisfies LeadEmAtendimento;
  });

  const mensagens = ((respostaMensagens.data ?? []) as LinhaMensagem[]).map(
    (linha) => {
      const nome = (linha.remetente_nome ?? "").trim();
      return {
        id: linha.id,
        leadId: linha.lead_id,
        remetente: {
          tipo: remetenteConhecido(linha.remetente_tipo),
          ...(nome === "" ? {} : { nome }),
        },
        formato: formatoConhecido(linha.formato),
        minutosAtras: minutosDesde(linha.criado_em, agora),
        // Mídia sem legenda chega com texto vazio, e é assim que fica: quem
        // decide o rótulo da bolha é `textoVisivel`, na exibição.
        texto: linha.texto ?? "",
        ...(linha.regra ? { regra: linha.regra } : {}),
        ...(statusConhecido(linha.status)
          ? { status: statusConhecido(linha.status) }
          : {}),
      } satisfies MensagemEmAtendimento;
    },
  );

  const notas = ((respostaNotas.data ?? []) as LinhaNota[]).map((linha) => ({
    id: linha.id,
    leadId: linha.lead_id,
    autor: (linha.autor_nome ?? "").trim() || "Equipe",
    minutosAtras: minutosDesde(linha.criado_em, agora),
    texto: linha.texto,
  }));

  return { leads, mensagens, notas, falha: null };
}
