/**
 * A via de leitura dos templates de WhatsApp.
 *
 * Três tabelas: `template_categorias` (o momento do fluxo que dispara, igual
 * para todos os clientes), `templates` (o conjunto de mensagens de um cliente
 * naquela categoria, só um ativo por vez) e `template_mensagens` (as bolhas,
 * em ordem).
 *
 * Até aqui a tela lia `src/data/templates.ts` — um arquivo de exemplo vazio —
 * e dizia a todo mundo que nenhum template existia, enquanto o cérebro da Helô
 * já lia estas tabelas no banco e já mandava essas mensagens em produção. A
 * agência não tinha tela nenhuma para mudar o texto que o cliente recebe.
 *
 * Por cliente, não "todos": o índice único de template ativo é por
 * `(clinica_id, categoria_id)`, então editar sem escolher o cliente não
 * significaria nada. Sem cliente escolhido a leitura devolve lista vazia e a
 * tela pede para escolher — ver `GerenciadorTemplates`.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import {
  FORMATOS_DE_MENSAGEM,
  type CategoriaDeTemplate,
  type FormatoDeMensagem,
  type MensagemDoTemplate,
  type TemplateDoCliente,
} from "@/data/templates";
import type { ClinicaDaLista } from "@/lib/dados/visaoGeral";

/** Ver o mesmo raciocínio em `dados/agenda.ts`. */
const TETO_DE_LINHAS = 1000;

type LinhaDeCategoria = {
  id: number;
  chave: string;
  nome_exibicao: string;
  ordem: number;
};

type LinhaDeTemplate = {
  id: number;
  categoria_id: number;
  nome: string;
  ativo: boolean;
};

type LinhaDeMensagem = {
  id: number;
  template_id: number;
  ordem: number;
  formato: string;
  texto: string | null;
  midia_url: string | null;
  delay_segundos: number;
};

export type DadosDosTemplates = {
  /** Para o seletor de cliente, inclusive os pausados — igual às outras telas. */
  clinicas: ClinicaDaLista[];
  /** Só as categorias ativas, na ordem em que o fluxo acontece. */
  categorias: CategoriaDeTemplate[];
  /** Os templates do cliente escolhido, com as mensagens já em ordem. */
  templates: TemplateDoCliente[];
  falha: string | null;
  aviso: string | null;
};

const SEM_DADOS: DadosDosTemplates = {
  clinicas: [],
  categorias: [],
  templates: [],
  falha: null,
  aviso: null,
};

/**
 * O formato gravado, conferido contra a lista que o CHECK do banco aceita.
 *
 * Linha com formato fora da lista não devia existir — o CHECK impede —, mas se
 * existisse, cair em "texto" esconderia a mídia da tela sem dizer nada. Então
 * vale o aviso: a leitura devolve `null` e a mensagem fica de fora, contada no
 * aviso da tela.
 */
function formatoValido(valor: string): FormatoDeMensagem | null {
  return (FORMATOS_DE_MENSAGEM as readonly string[]).includes(valor)
    ? (valor as FormatoDeMensagem)
    : null;
}

export async function carregarTemplates(
  clinicaId: number | null,
): Promise<DadosDosTemplates> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  const [respostaDasClinicas, respostaDasCategorias] = await Promise.all([
    // Todos os clientes, inclusive os pausados: a tela marca "(pausada)" no
    // seletor, igual aos Relatórios e à Visão Geral. Esconder um cliente
    // pausado tiraria da agência o acesso aos textos dele.
    supabase
      .from("clinicas")
      .select("id, nome, ativa")
      .order("nome", { ascending: true })
      .limit(TETO_DE_LINHAS),
    // Só as ativas: categoria desativada é momento de fluxo que saiu do ar, e
    // a tela não deve convidar ninguém a escrever para ela. `id` como segundo
    // critério para duas categorias com a mesma `ordem` não trocarem de lugar
    // entre duas aberturas da tela.
    supabase
      .from("template_categorias")
      .select("id, chave, nome_exibicao, ordem")
      .eq("ativa", true)
      .order("ordem", { ascending: true })
      .order("id", { ascending: true })
      .limit(TETO_DE_LINHAS),
  ]);

  const erroDeCima = respostaDasClinicas.error ?? respostaDasCategorias.error;
  if (erroDeCima) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler os templates: ${erroDeCima.message}`,
    };
  }

  const clinicas = (respostaDasClinicas.data ?? []) as ClinicaDaLista[];
  const categorias = (
    (respostaDasCategorias.data ?? []) as LinhaDeCategoria[]
  ).map((linha) => ({
    id: linha.id,
    chave: linha.chave,
    nomeExibicao: linha.nome_exibicao,
    ordem: linha.ordem,
  }));

  if (clinicaId === null) {
    return { ...SEM_DADOS, clinicas, categorias };
  }

  const { data: linhasDeTemplate, error: erroDosTemplates } = await supabase
    .from("templates")
    .select("id, categoria_id, nome, ativo")
    // O ativo primeiro, depois os antigos do mais novo para o mais velho: é
    // nessa ordem que a tela os mostra, e é o ativo que importa.
    .order("ativo", { ascending: false })
    .order("criado_em", { ascending: false })
    .eq("clinica_id", clinicaId)
    .limit(TETO_DE_LINHAS);

  if (erroDosTemplates) {
    return {
      ...SEM_DADOS,
      clinicas,
      categorias,
      falha: `Não deu para ler os templates: ${erroDosTemplates.message}`,
    };
  }

  const templates = (linhasDeTemplate ?? []) as LinhaDeTemplate[];

  if (templates.length === 0) {
    return { ...SEM_DADOS, clinicas, categorias };
  }

  // As bolhas de todos os templates deste cliente de uma vez, em vez de uma
  // leitura por template: são poucas linhas e uma consulta só.
  const { data: linhasDeMensagem, error: erroDasMensagens } = await supabase
    .from("template_mensagens")
    .select("id, template_id, ordem, formato, texto, midia_url, delay_segundos")
    .in(
      "template_id",
      templates.map((t) => t.id),
    )
    .order("template_id", { ascending: true })
    .order("ordem", { ascending: true })
    .limit(TETO_DE_LINHAS);

  if (erroDasMensagens) {
    return {
      ...SEM_DADOS,
      clinicas,
      categorias,
      falha: `Não deu para ler as mensagens dos templates: ${erroDasMensagens.message}`,
    };
  }

  const mensagens = (linhasDeMensagem ?? []) as LinhaDeMensagem[];

  const porTemplate = new Map<number, MensagemDoTemplate[]>();
  let formatoDesconhecido = 0;

  for (const linha of mensagens) {
    const formato = formatoValido(linha.formato);
    if (formato === null) {
      formatoDesconhecido += 1;
      continue;
    }

    const lista = porTemplate.get(linha.template_id) ?? [];
    lista.push({
      id: linha.id,
      ordem: linha.ordem,
      formato,
      texto: linha.texto,
      midiaUrl: linha.midia_url,
      delaySegundos: linha.delay_segundos,
    });
    porTemplate.set(linha.template_id, lista);
  }

  return {
    clinicas,
    categorias,
    templates: templates.map((linha) => ({
      id: linha.id,
      categoriaId: linha.categoria_id,
      nome: linha.nome,
      ativo: linha.ativo,
      mensagens: porTemplate.get(linha.id) ?? [],
    })),
    falha: null,
    aviso: montarAviso(templates.length, mensagens.length, formatoDesconhecido),
  };
}

function montarAviso(
  templates: number,
  mensagens: number,
  formatoDesconhecido: number,
) {
  const avisos: string[] = [];

  if (templates >= TETO_DE_LINHAS) {
    avisos.push(
      `Esta tela está mostrando no máximo ${TETO_DE_LINHAS} templates deste cliente. Nada foi perdido no banco.`,
    );
  }

  if (mensagens >= TETO_DE_LINHAS) {
    avisos.push(
      `Esta tela está mostrando no máximo ${TETO_DE_LINHAS} mensagens. Template com mensagem fora desse corte aparece incompleto aqui, mas continua inteiro no banco e é inteiro que a Helô envia.`,
    );
  }

  if (formatoDesconhecido > 0) {
    avisos.push(
      formatoDesconhecido === 1
        ? "Uma mensagem está gravada com um formato que esta tela não conhece e ficou de fora da lista. Ela continua no banco."
        : `${formatoDesconhecido} mensagens estão gravadas com um formato que esta tela não conhece e ficaram de fora da lista. Elas continuam no banco.`,
    );
  }

  return avisos.length > 0 ? avisos.join(" ") : null;
}
