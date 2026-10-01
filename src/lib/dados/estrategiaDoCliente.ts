/**
 * A via de leitura da Estratégia do Cliente.
 *
 * Até aqui esta tela lia `src/data/clinicas.ts`, um arquivo fixo no código, e
 * não gravava nada em lugar nenhum: o botão "Salvar estratégia" só acendia uma
 * confirmação verde por dois segundos. Quem preenchia a ficha achava que tinha
 * cadastrado a estratégia do cliente, e a Helô continuava lendo campo vazio no
 * banco — que é o jeito mais silencioso de uma informação não existir.
 *
 * O recorte é de propósito: só esta seção lê daqui. `src/data/clinicas.ts`
 * continua de pé porque outras oito telas o usam, e trocar a fonte lá embaixo
 * obrigaria a inventar campo para todas elas.
 *
 * A conversão de linha em ficha mora em `fichaDaEstrategia.ts`, onde pode ser
 * conferida sem sessão nem banco. É de lá que a tela importa tipo.
 *
 * Roda apenas no servidor.
 */
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import {
  montarFichaDaEstrategia,
  type ClienteDoSeletor,
  type FichaDaEstrategia,
  type LinhaDaClinica,
  type ProcedimentoDoCatalogo,
} from "@/lib/dados/fichaDaEstrategia";

export type { ClienteDoSeletor, FichaDaEstrategia, ProcedimentoDoCatalogo };

export type DadosDaEstrategia = {
  clientes: ClienteDoSeletor[];
  ficha: FichaDaEstrategia | null;
  /** O catálogo inteiro: é dele que sai o que marcar em cada convênio. */
  procedimentos: ProcedimentoDoCatalogo[];
  /**
   * A frase que aparece na tela quando não deu para ler. Em português de
   * gente — nada de "Supabase" nem de "banco", que são palavras de quem
   * construiu o painel e não de quem o usa.
   */
  falha: string | null;
  /** O erro técnico de verdade, em letra miúda, para quem for investigar. */
  detalheTecnico: string | null;
  aviso: string | null;
};

/** Ver o mesmo raciocínio em `dados/agenda.ts`. */
const TETO_DE_LINHAS = 1000;

const SEM_DADOS: DadosDaEstrategia = {
  clientes: [],
  ficha: null,
  procedimentos: [],
  falha: null,
  detalheTecnico: null,
  aviso: null,
};

const CAMPOS_DA_FICHA =
  "id, nome, cidade, ativa, objetivo_atendimento, prioridade_comercial, " +
  "tem_avaliacao_inicial, tipo_avaliacao, avaliacao_gratuita, " +
  "avaliacao_quando_cobrada, avaliacao_abate_procedimento, " +
  "helo_pode_informar_valor, politica_de_valores, formas_pagamento, " +
  "parcelamento, convenios, classe_economica, faixa_etaria_de, " +
  "faixa_etaria_ate, principais_dores, tom_predominante, diferenciais, " +
  "informacoes_a_evitar, observacoes_atendimento, historia, endereco, " +
  "horario_funcionamento";

/**
 * `clienteId` vem da URL (`?cliente=19`), então pode ser qualquer coisa: nulo,
 * texto, id de cliente que não existe mais. Nenhum desses casos é erro de
 * sistema — a resposta é abrir o primeiro cliente da lista e, quando o id foi
 * pedido e não existe, dizer isso no aviso. Link velho de um cliente apagado
 * não pode virar tela quebrada.
 */
export async function carregarEstrategiaDoCliente(
  clienteId: number | null,
): Promise<DadosDaEstrategia> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha:
        "Esta cópia do painel não está ligada aos dados, então não há estratégia para mostrar.",
      detalheTecnico:
        "As variáveis de ambiente do Supabase não estão definidas neste ambiente.",
    };
  }

  const supabase = await criarClienteServidor();

  const respostaDosClientes = await supabase
    .from("clinicas")
    .select(CAMPOS_DA_FICHA)
    .order("nome", { ascending: true })
    .limit(TETO_DE_LINHAS);

  if (respostaDosClientes.error) {
    return {
      ...SEM_DADOS,
      falha:
        "Não deu para abrir a estratégia agora. Tente de novo em instantes; se continuar, avise quem cuida do painel.",
      detalheTecnico: respostaDosClientes.error.message,
    };
  }

  const linhas = (respostaDosClientes.data ??
    []) as unknown as LinhaDaClinica[];

  const clientes: ClienteDoSeletor[] = linhas.map((linha) => ({
    id: linha.id,
    nome: (linha.nome ?? "").trim() || "Sem nome",
    cidade: (linha.cidade ?? "").trim(),
    ativa: linha.ativa === true,
  }));

  if (linhas.length === 0) {
    return { ...SEM_DADOS, clientes };
  }

  const pedida =
    clienteId === null ? null : linhas.find((l) => l.id === clienteId);
  const linha = pedida ?? linhas[0];

  const ficha = montarFichaDaEstrategia(linha);

  const avisos: string[] = [];

  if (clienteId !== null && !pedida) {
    avisos.push(
      `Não há cliente com o id ${clienteId}. Abrimos "${ficha.nome}" no lugar.`,
    );
  }

  if (linhas.length >= TETO_DE_LINHAS) {
    avisos.push(
      `O seletor está mostrando no máximo ${TETO_DE_LINHAS} clientes. Nada foi perdido, mas esta lista não está completa.`,
    );
  }

  /*
    O catálogo inteiro, e não só os procedimentos citados nos convênios de hoje.

    Enquanto a tela só lia, bastava buscar o nome dos ids citados. Agora ela
    edita: para marcar quais procedimentos um convênio cobre é preciso oferecer
    todos os que existem. `especialidades` é catálogo global, sem `clinica_id`,
    então é uma leitura só para qualquer cliente.

    Falhar aqui não esconde a estratégia inteira — é detalhe do bloco de
    convênios. O convênio aparece com o aviso, e o resto continua de pé.
  */
  const respostaDosProcedimentos = await supabase
    .from("especialidades")
    .select("id, nome, ativa")
    .order("nome", { ascending: true })
    .limit(TETO_DE_LINHAS);

  const procedimentos: ProcedimentoDoCatalogo[] = [];

  if (respostaDosProcedimentos.error) {
    avisos.push(
      "Não deu para ler a lista de procedimentos. Os convênios aparecem sem o nome do que cobrem, e não dá para mudá-los agora.",
    );
  } else {
    for (const procedimento of (respostaDosProcedimentos.data ?? []) as {
      id: number;
      nome: string | null;
      ativa: boolean | null;
    }[]) {
      procedimentos.push({
        id: procedimento.id,
        nome: (procedimento.nome ?? "").trim() || "Sem nome",
        ativa: procedimento.ativa === true,
      });
    }
  }

  return {
    clientes,
    ficha,
    procedimentos,
    falha: null,
    detalheTecnico: null,
    aviso: avisos.length > 0 ? avisos.join(" ") : null,
  };
}
