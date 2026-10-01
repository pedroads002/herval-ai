/**
 * A leitura do formulário da Estratégia do Cliente: o que veio da tela virando
 * colunas de `clinicas`, ou um motivo em português para recusar.
 *
 * Mora fora do arquivo `"use server"` pelo mesmo motivo de
 * `consultaDoFormulario.ts`: ali só função assíncrona pode ser exportada, e todo
 * export vira endereço chamável de fora. Aqui há tipo, constante e função
 * síncrona, e nada disso deve virar endpoint. O outro motivo é teste — sem
 * sessão nem banco no caminho, cada recusa pode ser conferida uma por uma.
 *
 * **Só as colunas do bloco enviado voltam daqui.** Cada cartão da tela grava
 * sozinho, e um envio do bloco 1 que devolvesse as vinte colunas apagaria os
 * outros quatro blocos com nulo. Daí o campo escondido `bloco`: ele diz o que
 * aquele envio tem o direito de tocar, e o resto nem é lido.
 *
 * Cada recusa aqui existe porque o banco recusaria também — as listas fechadas,
 * o teto de 24 parcelas, as duas idades entre 0 e 120 e o "de" não passando o
 * "até" são CHECK em `supabase/estrategia-do-cliente.sql`. Deixar o banco
 * recusar funcionaria, mas a mensagem que sobe de lá é em inglês e cita o nome
 * da constraint, e isso não serve para quem está preenchendo a ficha.
 */

import {
  BLOCOS_DA_ESTRATEGIA,
  CLASSES_ECONOMICAS,
  FORMAS_DE_PAGAMENTO,
  IDADE_MAXIMA,
  IDADE_MINIMA,
  OBJETIVOS_DE_ATENDIMENTO,
  PARCELAMENTO_MAXIMO,
  POLITICAS_DE_VALORES,
  PRIORIDADES_COMERCIAIS,
  QUANDO_A_AVALIACAO_E_COBRADA,
  TIPOS_DE_AVALIACAO,
  VALOR_MEDIO_MAXIMO,
  type BlocoDaEstrategia,
} from "@/lib/dados/fichaDaEstrategia";

/**
 * Até onde cada texto pode ir.
 *
 * Nenhum destes limites existe no banco — as colunas são `text`, sem tamanho. O
 * limite é do prompt: tudo isto é interpolado no sistema do `Supervisor1`, e um
 * campo de dez mil caracteres empurra as travas para longe do topo, onde elas
 * são obedecidas menos. Os números são folgados para o uso real e apertados o
 * suficiente para ninguém colar um documento inteiro aqui.
 */
const LIMITE_TOM = 120;
const LIMITE_PARAGRAFO = 2000;
const LIMITE_RESTRICAO = 1000;
const LIMITE_DOR = 160;
const LIMITE_NOME_DE_CONVENIO = 120;

/** Quantas linhas de lista a tela aceita. Teto de sanidade, não de regra. */
const MAXIMO_DE_DORES = 20;
const MAXIMO_DE_CONVENIOS = 20;

/** Um convênio como a coluna jsonb o guarda. */
export type ConvenioGravavel = {
  nome: string;
  especialidade_ids: number[];
};

/**
 * Uma faixa de valor médio como `clinica_especialidades` a guarda.
 *
 * Esta é a única coisa que esta tela grava fora de `clinicas`, e por isso vem
 * separada dos campos: é outra tabela, com outra chave.
 */
export type FaixaGravavel = {
  especialidade_id: number;
  valor_medio_de: number;
  valor_medio_ate: number;
};

/**
 * As colunas de `clinicas` que esta tela grava. Todas opcionais porque cada
 * envio traz só as do seu bloco.
 */
export type CamposDaEstrategia = {
  objetivo_atendimento?: string | null;
  prioridade_comercial?: string | null;

  tem_avaliacao_inicial?: boolean | null;
  tipo_avaliacao?: string | null;
  avaliacao_gratuita?: boolean | null;
  avaliacao_quando_cobrada?: string | null;
  avaliacao_abate_procedimento?: boolean | null;
  helo_pode_informar_valor?: boolean | null;

  formas_pagamento?: string[];
  parcelamento?: number | null;
  convenios?: ConvenioGravavel[];
  politica_de_valores?: string | null;

  classe_economica?: string[];
  faixa_etaria_de?: number | null;
  faixa_etaria_ate?: number | null;
  principais_dores?: string[];

  tom_predominante?: string | null;
  diferenciais?: string | null;
  informacoes_a_evitar?: string | null;
  observacoes_atendimento?: string | null;
  historia?: string | null;
};

/**
 * Ou o valor, ou o motivo da recusa.
 *
 * Declarado em vez de inferido de propósito: inferido, cada ramo ganha a outra
 * chave como `erro?: undefined`, e aí `"erro" in resultado` deixa de separar os
 * dois casos — o compilador continua achando que o ramo bom também pode ter
 * `erro`. Com o tipo escrito à mão, a conferência volta a valer.
 */
type Talvez<T> = { erro: string } | { valor: T };

export type EstrategiaGravavel = {
  clienteId: number;
  bloco: BlocoDaEstrategia;
  campos: CamposDaEstrategia;
  /**
   * As faixas de valor médio deste envio, ou nulo quando o bloco não é o
   * Comercial.
   *
   * Nulo e lista vazia são coisas diferentes aqui, e a diferença é destrutiva:
   * vazia quer dizer "este cliente não tem faixa nenhuma", e a gravação apaga as
   * que havia; nulo quer dizer "este envio não fala de faixa", e a gravação nem
   * encosta naquela tabela.
   */
  faixas: FaixaGravavel[] | null;
};

export function lerEstrategia(
  formData: FormData,
): { erro: string } | EstrategiaGravavel {
  const clienteId = inteiroPositivo(formData.get("cliente"));
  if (clienteId === null) {
    return { erro: "Não deu para saber de qual cliente é esta estratégia." };
  }

  const nomeDoBloco = String(formData.get("bloco") ?? "");
  if (!(BLOCOS_DA_ESTRATEGIA as readonly string[]).includes(nomeDoBloco)) {
    return { erro: "Não deu para saber qual parte da estratégia foi enviada." };
  }
  const bloco = nomeDoBloco as BlocoDaEstrategia;

  const campos = lerBloco(bloco, formData);
  if ("erro" in campos) return campos;

  return {
    clienteId,
    bloco,
    campos: campos.campos,
    faixas: campos.faixas ?? null,
  };
}

function lerBloco(
  bloco: BlocoDaEstrategia,
  formData: FormData,
): { erro: string } | { campos: CamposDaEstrategia; faixas?: FaixaGravavel[] } {
  if (bloco === "objetivo") {
    const objetivo = daLista(
      formData,
      "objetivo_atendimento",
      OBJETIVOS_DE_ATENDIMENTO,
    );
    if ("erro" in objetivo) {
      return { erro: "Esse objetivo de atendimento não está na lista." };
    }

    const prioridade = daLista(
      formData,
      "prioridade_comercial",
      PRIORIDADES_COMERCIAIS,
    );
    if ("erro" in prioridade) {
      return { erro: "Essa prioridade comercial não está na lista." };
    }

    return {
      campos: {
        objetivo_atendimento: objetivo.valor,
        prioridade_comercial: prioridade.valor,
      },
    };
  }

  if (bloco === "avaliacao") {
    const tipo = daLista(formData, "tipo_avaliacao", TIPOS_DE_AVALIACAO);
    if ("erro" in tipo) return { erro: "Esse tipo de avaliação não existe." };

    const quando = daLista(
      formData,
      "avaliacao_quando_cobrada",
      QUANDO_A_AVALIACAO_E_COBRADA,
    );
    if ("erro" in quando) {
      return { erro: "Essa opção de quando a avaliação é cobrada não existe." };
    }

    const tem = talvezSimOuNao(formData, "tem_avaliacao_inicial");
    if ("erro" in tem) return tem;
    const gratuita = talvezSimOuNao(formData, "avaliacao_gratuita");
    if ("erro" in gratuita) return gratuita;
    const abate = talvezSimOuNao(formData, "avaliacao_abate_procedimento");
    if ("erro" in abate) return abate;
    const podeFalarDeValor = talvezSimOuNao(
      formData,
      "helo_pode_informar_valor",
    );
    if ("erro" in podeFalarDeValor) return podeFalarDeValor;

    /*
      Quem respondeu que não tem avaliação inicial não pode deixar atrás de si o
      tipo e a cobrança de uma avaliação que não existe. Isso não é capricho de
      tela: esses campos vão todos para o prompt, e "não tem avaliação" junto de
      "tipo: Presencial" faz a Helô falar de uma avaliação presencial que o
      cliente não oferece.
    */
    if (tem.valor === false) {
      return {
        campos: {
          tem_avaliacao_inicial: false,
          tipo_avaliacao: null,
          avaliacao_gratuita: null,
          avaliacao_quando_cobrada: null,
          avaliacao_abate_procedimento: null,
          helo_pode_informar_valor: podeFalarDeValor.valor,
        },
      };
    }

    // Gratuita não é cobrada nunca, e o que não foi pago não abate nada.
    if (gratuita.valor === true) {
      return {
        campos: {
          tem_avaliacao_inicial: tem.valor,
          tipo_avaliacao: tipo.valor,
          avaliacao_gratuita: true,
          avaliacao_quando_cobrada: null,
          avaliacao_abate_procedimento: null,
          helo_pode_informar_valor: podeFalarDeValor.valor,
        },
      };
    }

    return {
      campos: {
        tem_avaliacao_inicial: tem.valor,
        tipo_avaliacao: tipo.valor,
        avaliacao_gratuita: gratuita.valor,
        avaliacao_quando_cobrada: quando.valor,
        avaliacao_abate_procedimento: abate.valor,
        helo_pode_informar_valor: podeFalarDeValor.valor,
      },
    };
  }

  if (bloco === "comercial") {
    const politica = daLista(
      formData,
      "politica_de_valores",
      POLITICAS_DE_VALORES,
    );
    if ("erro" in politica) {
      return { erro: "Essa política de valores não está na lista." };
    }

    const formas = daListaMarcada(
      formData,
      "formas_pagamento",
      FORMAS_DE_PAGAMENTO,
    );
    if ("erro" in formas) {
      return { erro: "Alguma forma de pagamento marcada não está na lista." };
    }

    const parcelamento = textoDoCampo(formData, "parcelamento");
    let parcelas: number | null = null;
    if (parcelamento !== null) {
      parcelas = inteiroPositivo(parcelamento);
      if (parcelas === null || parcelas > PARCELAMENTO_MAXIMO) {
        return {
          erro: `O parcelamento tem de ser um número de 1 a ${PARCELAMENTO_MAXIMO}.`,
        };
      }
    }

    const convenios = lerConvenios(formData);
    if ("erro" in convenios) return convenios;

    const faixas = lerFaixasDeValor(formData);
    if ("erro" in faixas) return faixas;

    return {
      campos: {
        formas_pagamento: formas.valores,
        parcelamento: parcelas,
        convenios: convenios.convenios,
        politica_de_valores: politica.valor,
      },
      faixas: faixas.faixas,
    };
  }

  if (bloco === "publico") {
    const classes = daListaMarcada(
      formData,
      "classe_economica",
      CLASSES_ECONOMICAS,
    );
    if ("erro" in classes) {
      return { erro: "Alguma classe econômica marcada não está na lista." };
    }

    const de = idade(formData, "faixa_etaria_de");
    if ("erro" in de) return de;
    const ate = idade(formData, "faixa_etaria_ate");
    if ("erro" in ate) return ate;

    if (de.valor !== null && ate.valor !== null && de.valor > ate.valor) {
      return {
        erro: "A idade de início está acima da idade final. Confira a faixa.",
      };
    }

    const dores = linhas(formData, "principais_dores");
    if (dores.length > MAXIMO_DE_DORES) {
      return {
        erro: `São no máximo ${MAXIMO_DE_DORES} dores, uma por linha. Junte as parecidas.`,
      };
    }
    const doreLonga = dores.find((dor) => dor.length > LIMITE_DOR);
    if (doreLonga !== undefined) {
      return {
        erro: `Cada dor cabe em ${LIMITE_DOR} caracteres. Uma delas passou — resuma em uma frase curta.`,
      };
    }

    return {
      campos: {
        classe_economica: classes.valores,
        faixa_etaria_de: de.valor,
        faixa_etaria_ate: ate.valor,
        principais_dores: dores,
      },
    };
  }

  // bloco === "comunicacao"
  const tom = textoLimitado(formData, "tom_predominante", LIMITE_TOM);
  if ("erro" in tom) {
    return {
      erro: `O tom predominante cabe em ${LIMITE_TOM} caracteres. É uma expressão, não um parágrafo.`,
    };
  }

  const diferenciais = textoLimitado(
    formData,
    "diferenciais",
    LIMITE_PARAGRAFO,
  );
  if ("erro" in diferenciais) return { erro: longoDemais("Os diferenciais") };

  const evitar = textoLimitado(
    formData,
    "informacoes_a_evitar",
    LIMITE_RESTRICAO,
  );
  if ("erro" in evitar) {
    return { erro: longoDemais("As informações a evitar") };
  }

  const observacoes = textoLimitado(
    formData,
    "observacoes_atendimento",
    LIMITE_RESTRICAO,
  );
  if ("erro" in observacoes) {
    return { erro: longoDemais("As observações de atendimento") };
  }

  const historia = textoLimitado(formData, "historia", LIMITE_PARAGRAFO);
  if ("erro" in historia) return { erro: longoDemais("A história") };

  return {
    campos: {
      tom_predominante: tom.valor,
      diferenciais: diferenciais.valor,
      informacoes_a_evitar: evitar.valor,
      observacoes_atendimento: observacoes.valor,
      historia: historia.valor,
    },
  };
}

function longoDemais(oQue: string) {
  return `${oQue} passaram do tamanho que cabe no prompt da Helô. Resuma o texto.`;
}

/**
 * Os convênios, lidos linha por linha.
 *
 * A tela numera os campos (`convenio-0-nome`, `convenio-1-nome`, …) e a leitura
 * varre até onde a numeração for. Linha sem nome é descartada em silêncio, e não
 * é erro: é como alguém apaga um convênio — esvazia o nome. É a mesma regra de
 * `montarConvenios`, que também joga fora convênio sem nome ao ler do banco.
 */
function lerConvenios(
  formData: FormData,
): { erro: string } | { convenios: ConvenioGravavel[] } {
  const convenios: ConvenioGravavel[] = [];

  for (let i = 0; i < MAXIMO_DE_CONVENIOS; i += 1) {
    if (!formData.has(`convenio-${i}-nome`)) continue;

    const nome = String(formData.get(`convenio-${i}-nome`) ?? "").trim();
    if (nome === "") continue;

    if (nome.length > LIMITE_NOME_DE_CONVENIO) {
      return {
        erro: `O nome de um convênio passou de ${LIMITE_NOME_DE_CONVENIO} caracteres.`,
      };
    }

    if (convenios.some((convenio) => convenio.nome === nome)) {
      return {
        erro: `"${nome}" aparece duas vezes. Junte os procedimentos num convênio só.`,
      };
    }

    const ids: number[] = [];
    for (const bruto of formData.getAll(`convenio-${i}-procedimentos`)) {
      const id = inteiroPositivo(bruto);
      if (id === null) {
        return { erro: "Um procedimento marcado em convênio não é válido." };
      }
      if (!ids.includes(id)) ids.push(id);
    }

    convenios.push({ nome, especialidade_ids: ids });
  }

  return { convenios };
}

/**
 * As faixas de valor médio, lidas procedimento por procedimento.
 *
 * A tela manda um par por procedimento que ela mostrou (`faixa-7-de`,
 * `faixa-7-ate`), e a varredura é pelas chaves do envio, não por uma lista
 * fechada: quem decide quais procedimentos aparecem é a tela, e ela muda quando
 * o catálogo muda.
 *
 * Os dois campos em branco é como se apaga uma faixa, e não é erro. Um campo só
 * é erro de propósito: "a partir de R$ 800" sem o outro limite é exatamente o
 * que a política mais estrita proíbe, e deixar passar em silêncio seria gravar
 * meia faixa que o banco recusaria depois, em inglês.
 */
function lerFaixasDeValor(
  formData: FormData,
): { erro: string } | { faixas: FaixaGravavel[] } {
  const faixas: FaixaGravavel[] = [];

  for (const chave of formData.keys()) {
    const encontrado = /^faixa-(\d+)-de$/.exec(chave);
    if (encontrado === null) continue;

    const id = inteiroPositivo(encontrado[1]);
    if (id === null) continue;
    if (faixas.some((faixa) => faixa.especialidade_id === id)) continue;

    const de = reais(formData, `faixa-${id}-de`);
    if ("erro" in de) return de;
    const ate = reais(formData, `faixa-${id}-ate`);
    if ("erro" in ate) return ate;

    if (de.valor === null && ate.valor === null) continue;

    if (de.valor === null || ate.valor === null) {
      return {
        erro: "Uma faixa de valor médio ficou com metade preenchida. Preencha o 'de' e o 'até', ou deixe os dois em branco para a equipe confirmar.",
      };
    }

    if (de.valor > ate.valor) {
      return {
        erro: "Numa faixa de valor médio o 'de' ficou acima do 'até'. Confira os dois números.",
      };
    }

    /*
      Os dois limites iguais não é faixa, é preço fechado com outro nome: "de
      R$ 950 a R$ 950" é uma cotação, e cotação fora da consulta de avaliação é
      o que não pode existir em campo nenhum. Mesma trava do CHECK no banco.
    */
    if (de.valor === ate.valor) {
      return {
        erro: "Uma faixa ficou com os dois limites iguais, e isso é preço fechado, não média. Se o valor varia pouco, use uma margem — R$ 900 a R$ 1.000.",
      };
    }

    faixas.push({
      especialidade_id: id,
      valor_medio_de: de.valor,
      valor_medio_ate: ate.valor,
    });
  }

  return { faixas };
}

/**
 * Um valor em reais inteiros.
 *
 * Sem centavo de propósito: isto é média aproximada, e centavo em cima de uma
 * aproximação é precisão falsa — é o que faria a estimativa parecer orçamento.
 */
function reais(formData: FormData, campo: string): Talvez<number | null> {
  const bruto = textoDoCampo(formData, campo);
  if (bruto === null) return { valor: null };

  const numero = Number(bruto);
  if (!Number.isInteger(numero) || numero <= 0) {
    return {
      erro: "O valor médio tem de ser um número inteiro de reais, sem centavo.",
    };
  }
  if (numero > VALOR_MEDIO_MAXIMO) {
    return {
      erro: `O valor médio passou de R$ ${VALOR_MEDIO_MAXIMO.toLocaleString("pt-BR")}. Confira se não sobrou um zero.`,
    };
  }
  return { valor: numero };
}

function inteiroPositivo(bruto: FormDataEntryValue | string | null) {
  const numero = Number(String(bruto ?? "").trim());
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function textoDoCampo(formData: FormData, campo: string) {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function textoLimitado(
  formData: FormData,
  campo: string,
  limite: number,
): Talvez<string | null> {
  const valor = textoDoCampo(formData, campo);
  if (valor !== null && valor.length > limite) return { erro: "longo" };
  return { valor };
}

/** Um valor de lista fechada. Vazio é nulo — "ninguém escolheu" é resposta. */
function daLista<T extends string>(
  formData: FormData,
  campo: string,
  lista: readonly T[],
): Talvez<string | null> {
  const valor = textoDoCampo(formData, campo);
  if (valor === null) return { valor: null };
  if (!lista.includes(valor as T)) return { erro: "fora da lista" };
  return { valor };
}

/**
 * As caixas marcadas de uma lista fechada.
 *
 * A ordem devolvida é a da lista, não a da marcação, pelo mesmo motivo de
 * `listaDaLista` na leitura: assim a coluna não muda de conteúdo só porque
 * alguém clicou nas caixas em outra sequência, e um `update` que não mudou nada
 * não vira uma linha diferente no banco.
 */
function daListaMarcada<T extends string>(
  formData: FormData,
  campo: string,
  lista: readonly T[],
): { erro: string } | { valores: string[] } {
  const marcados = formData.getAll(campo).map((v) => String(v).trim());
  if (marcados.some((valor) => !lista.includes(valor as T))) {
    return { erro: "fora da lista" };
  }
  return {
    valores: lista.filter((item) => marcados.includes(item)) as string[],
  };
}

/**
 * Sim, não, ou ninguém respondeu.
 *
 * Três estados e não dois porque nulo e falso são coisas diferentes para a Helô:
 * "não é gratuita" ela fala, "(não cadastrado)" ela vai confirmar com a equipe.
 * Um `<input type="checkbox">` só sabe dois estados, e é por isso que a tela usa
 * um seletor de três opções aqui.
 */
function talvezSimOuNao(
  formData: FormData,
  campo: string,
): Talvez<boolean | null> {
  const valor = String(formData.get(campo) ?? "").trim();
  if (valor === "") return { valor: null };
  if (valor === "sim") return { valor: true };
  if (valor === "nao") return { valor: false };
  return { erro: "Uma resposta de sim ou não veio num formato inesperado." };
}

function idade(formData: FormData, campo: string): Talvez<number | null> {
  const bruto = textoDoCampo(formData, campo);
  if (bruto === null) return { valor: null };

  const numero = Number(bruto);
  if (
    !Number.isInteger(numero) ||
    numero < IDADE_MINIMA ||
    numero > IDADE_MAXIMA
  ) {
    return {
      erro: `A idade tem de ser um número inteiro de ${IDADE_MINIMA} a ${IDADE_MAXIMA}.`,
    };
  }
  return { valor: numero };
}

/** Um texto de várias linhas virando lista. Linha vazia não entra. */
function linhas(formData: FormData, campo: string): string[] {
  return String(formData.get(campo) ?? "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "");
}
