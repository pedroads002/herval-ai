/**
 * O que cada escolha da estratégia muda no atendimento da Helô.
 *
 * É texto fixo, escolhido por valor — nunca uma chamada de IA para gerar a
 * frase na hora. Duas razões, e a segunda é a que importa: uma chamada custaria
 * tempo e dinheiro a cada desenho da tela, e, pior, a Helô estaria dando uma
 * segunda opinião sobre si mesma. Isto aqui não é opinião: é a leitura do que o
 * prompt do `Supervisor1` manda, e tem de dizer exatamente o que o prompt diz.
 *
 * Conferido contra o prompt ao vivo do node `Supervisor1` no workflow
 * `Helô - base` (`gDP9Cy9pPeRGaRS5`, versão ativa `cf3058c2-2cd0-4bd1-927f-1164a3ee886a`),
 * lido em 01/10/2026. Quem mexer no prompt mexe aqui: uma tela que promete
 * comportamento que o prompt não tem é pior que uma tela sem promessa nenhuma.
 *
 * Cuidado deliberado: onde o prompt só interpola o campo, sem regra em cima
 * dele, a frase diz isso com todas as letras. "Entra no contexto" é menos
 * vendável que "a Helô faz X", e é o que é verdade.
 *
 * Campo em branco sempre tem frase. O prompt troca vazio por "(não cadastrado)"
 * e manda tratar como algo que a Helô NÃO SABE e vai confirmar com a equipe —
 * então o branco também tem consequência, e ela precisa aparecer.
 */

import { PARCELAMENTO_MAXIMO } from "@/lib/dados/fichaDaEstrategia";
import type {
  FichaDaEstrategia,
  ObjetivoDeAtendimento,
  PoliticaDeValores,
  PrioridadeComercial,
  QuandoCobrada,
  TipoDeAvaliacao,
} from "@/lib/dados/fichaDaEstrategia";

/** A frase que vale quando ninguém preencheu o campo. */
const EM_BRANCO =
  "Em branco, a Helô recebe “(não cadastrado)” e trata como algo que ela não sabe: diz que vai confirmar com a equipe.";

const POR_OBJETIVO: Record<ObjetivoDeAtendimento, string> = {
  "Agendar avaliação":
    "A Helô conduz toda conversa para marcar a avaliação, e não troca esse desfecho por outro que pareça mais fácil.",
  "Agendar consulta":
    "A Helô conduz para a consulta em si, sem passar pela avaliação como etapa obrigatória da conversa.",
  "Qualificar antes do agendamento":
    "A Helô entende o caso primeiro e só depois leva para o agendamento — uma pergunta por mensagem, nunca duas.",
  "Encaminhar para humano":
    "A Helô não tenta marcar nada: ela acolhe, entende o pedido e passa para a equipe.",
  Outro:
    "A Helô recebe “Outro” como objetivo e não sabe para onde conduzir. Vale escrever o que ela deve perseguir nas observações de atendimento.",
};

export function consequenciaDoObjetivo(
  valor: ObjetivoDeAtendimento | null,
): string {
  if (valor === null) {
    return "Sem objetivo cadastrado, a Helô cai no que o prompt dela já diz: levar a conversa até uma avaliação marcada.";
  }
  return POR_OBJETIVO[valor];
}

/*
  A prioridade comercial entra no prompt como uma linha de contexto, na seção
  "Como este cliente quer ser atendido". Não existe regra dura em cima dela — ao
  contrário do objetivo, que tem instrução própria logo abaixo. A frase diz
  isso: prometer que a Helô "foca no carro-chefe" seria inventar comportamento.
*/
const POR_PRIORIDADE: Record<PrioridadeComercial, string> = {
  "Volume de agendamentos": "puxar agendamento sempre que houver abertura",
  "Ocupar agenda ociosa": "oferecer horário em vez de esperar o pedido",
  "Procedimento carro-chefe": "trazer o procedimento principal para a conversa",
  "Fidelizar base": "tratar quem já é paciente como quem já é paciente",
};

export function consequenciaDaPrioridade(
  valor: PrioridadeComercial | null,
): string {
  if (valor === null) {
    return "Sem prioridade cadastrada, a Helô não tem inclinação nenhuma: ela só persegue o objetivo acima.";
  }
  return `A Helô lê isto como contexto e tende a ${POR_PRIORIDADE[valor]}. É inclinação, não regra: o que manda é o objetivo acima.`;
}

const POR_TIPO_DE_AVALIACAO: Record<TipoDeAvaliacao, string> = {
  Presencial: "A Helô fala da avaliação como presencial, na unidade.",
  Online: "A Helô fala da avaliação como online, sem deslocamento.",
  Ambas:
    "A Helô pode oferecer os dois formatos e deixa a pessoa escolher o que preferir.",
};

export function consequenciaDoTipoDeAvaliacao(
  valor: TipoDeAvaliacao | null,
): string {
  return valor === null ? EM_BRANCO : POR_TIPO_DE_AVALIACAO[valor];
}

export function consequenciaDeTerAvaliacao(valor: boolean | null): string {
  if (valor === null) return EM_BRANCO;
  return valor
    ? "A Helô trata a avaliação como o passo antes do procedimento e é para lá que ela leva a conversa."
    : "A Helô não oferece avaliação como etapa: a conversa vai direto para o procedimento.";
}

export function consequenciaDaGratuidade(valor: boolean | null): string {
  if (valor === null) return EM_BRANCO;
  return valor
    ? "A Helô pode afirmar que a avaliação é gratuita. É a única coisa sobre dinheiro que ela afirma sem consultar a equipe."
    : "A Helô diz que a avaliação é cobrada, e que a equipe confirma o valor. Ela não fecha número por conta própria.";
}

const POR_QUANDO_COBRADA: Record<QuandoCobrada, string> = {
  Sempre: "A Helô diz que a avaliação é cobrada em qualquer caso.",
  "Só quando o paciente não fecha o procedimento":
    "A Helô explica que a avaliação só é cobrada se a pessoa não seguir com o procedimento.",
  "Só em alguns procedimentos":
    "A Helô diz que depende do procedimento e que a equipe confirma qual é o caso.",
  Nunca: "A Helô diz que a avaliação não é cobrada.",
};

export function consequenciaDeQuandoCobrada(valor: QuandoCobrada | null) {
  return valor === null ? EM_BRANCO : POR_QUANDO_COBRADA[valor];
}

export function consequenciaDoAbatimento(valor: boolean | null): string {
  if (valor === null) return EM_BRANCO;
  return valor
    ? "A Helô pode dizer que o que foi pago na avaliação abate no procedimento — sem citar número."
    : "A Helô não promete abatimento: o que foi pago na avaliação fica pago.";
}

/*
  Valor é o ponto mais sensível do prompt, e as duas linhas (política e
  permissão) estão juntas na regra 2 da seção de travas, perto do topo. O prompt
  é explícito: essas duas linhas só APERTAM a regra 1, nunca a soltam. E a regra
  1 é um piso igual para todo cliente: média aproximada só se o paciente
  perguntar, nunca oferecida; valor fechado nunca antes da consulta de avaliação.
  Nenhuma combinação daqui autoriza a Helô a fechar um número — no máximo aperta
  até ela não falar de valor nenhum.
*/
const POR_POLITICA: Record<PoliticaDeValores, string> = {
  "Pode informar":
    "A Helô pode entrar no assunto valor e, se perguntarem, passar uma média. Fechar o número, não: isso é da consulta de avaliação.",
  "Só a partir de":
    "A Helô pode falar em “a partir de”, sem fechar número — quem fecha é a equipe.",
  "Só se perguntarem":
    "A Helô não traz valor por conta própria. Se a pessoa perguntar, ela pode passar uma média; o valor fechado fica para a avaliação.",
  "Não informa antes da avaliação":
    "A Helô não fala de valor antes da avaliação: nem número, nem faixa, nem “a partir de”. O assunto fica para depois.",
};

export function consequenciaDaPoliticaDeValores(
  politica: PoliticaDeValores | null,
  podeInformarValor: boolean | null,
): string {
  const base =
    politica === null
      ? "Sem política cadastrada, vale só a regra de sempre: média aproximada apenas se a pessoa perguntar, e valor fechado só na consulta de avaliação."
      : POR_POLITICA[politica];

  if (podeInformarValor === false) {
    return `${base} E, como “a Helô pode falar de valor” está em não, ela nem abre o assunto.`;
  }
  if (podeInformarValor === null) {
    return `${base} Falta dizer se ela pode falar de valor; sem isso ela fica na regra mais apertada.`;
  }
  return base;
}

/*
  As duas listas abaixo recebem `readonly string[]`, e não o tipo fechado, de
  propósito: elas só contam e emendam os itens, e exigir o tipo fechado obrigaria
  a tela a converter o estado do formulário — que é texto de caixa marcada — a
  cada desenho, só para montar uma frase.
*/
export function consequenciaDasFormasDePagamento(
  formas: readonly string[],
): string {
  if (formas.length === 0) return EM_BRANCO;
  return `A Helô pode dizer que o cliente recebe em ${listar(formas)} — sem falar de número nenhum.`;
}

export function consequenciaDoParcelamento(valor: number | null): string {
  if (valor === null) return EM_BRANCO;

  /*
    A tela já recusa número fora de 1 a PARCELAMENTO_MAXIMO, e a gravação
    recusa de novo. Mesmo assim esta função checa: ela é a única frase da
    prévia que repete um número digitado, e prometer "até 30x" para algo que
    nunca vai ser gravado é pior que não prometer nada.
  */
  if (!Number.isInteger(valor) || valor < 1 || valor > PARCELAMENTO_MAXIMO) {
    return `Este número não é gravável: o parcelamento vai de 1 a ${PARCELAMENTO_MAXIMO}. Enquanto estiver assim, a Helô continua com o que já estava salvo.`;
  }

  return `A Helô pode dizer que dá para dividir em até ${valor}x. Quantas vezes, não quanto: o valor da parcela é assunto da equipe.`;
}

export function consequenciaDosConvenios(quantos: number): string {
  if (quantos === 0) {
    return "Em branco, a Helô recebe “(não cadastrado)” e tem ordem explícita de NÃO concluir que o cliente não aceita convênio. Ela diz que confirma com a equipe.";
  }
  return `A Helô sabe que ${quantos === 1 ? "há 1 convênio" : `há ${quantos} convênios`} e quais procedimentos cada um cobre. Fora dessa lista, ela confirma com a equipe.`;
}

/**
 * O que a faixa de valor médio faz a Helô dizer.
 *
 * `quantos` é quantos procedimentos têm faixa; `total`, quantos existem. A
 * frase precisa dos dois porque "3 com faixa" quer dizer coisas diferentes
 * quando existem 3 procedimentos e quando existem 23 — e é justamente nos sem
 * faixa que ela vai dizer que confirma com a equipe.
 */
export function consequenciaDoValorMedio(
  quantos: number,
  total: number,
): string {
  if (quantos === 0) {
    return "Sem faixa cadastrada, a Helô não tem média nenhuma para dar: se perguntarem quanto custa, ela diz que confirma o valor com a equipe. Ela não inventa número.";
  }

  const semFaixa = Math.max(total - quantos, 0);
  const inicio = `Se o paciente perguntar, a Helô pode passar a faixa aproximada ${quantos === 1 ? "desse procedimento" : `desses ${quantos} procedimentos`} — sempre como média, nunca como valor fechado, e nunca por iniciativa dela.`;

  if (semFaixa === 0) return inicio;

  return `${inicio} Nos outros ${semFaixa}, ela confirma o valor com a equipe.`;
}

export function consequenciaDasClasses(classes: readonly string[]): string {
  if (classes.length === 0) return EM_BRANCO;
  return `A Helô ajusta o tom para o público ${listar(classes)}. É tom, não filtro: ela não recusa ninguém por isso.`;
}

export function consequenciaDaFaixaEtaria(
  de: number | null,
  ate: number | null,
): string {
  if (de === null && ate === null) return EM_BRANCO;
  return "A Helô usa a faixa para calibrar como fala. Ela não pergunta a idade para conferir, e não dispensa quem está fora.";
}

export function consequenciaDasDores(quantas: number): string {
  if (quantas === 0) return EM_BRANCO;
  return `A Helô reconhece ${quantas === 1 ? "essa dor" : "essas dores"} quando aparecem na conversa e responde por ${quantas === 1 ? "ela" : "elas"} em vez de tratar como pergunta nova.`;
}

export function consequenciaDoTom(tom: string): string {
  if (tom === "") {
    return "Sem tom cadastrado, vale o tom padrão do prompt: português do Brasil, de pessoa e não de empresa, direto e caloroso.";
  }
  return "Este texto entra na seção de como a Helô escreve, junto das regras de tom. Ele ajusta o jeito dela, não o conteúdo.";
}

export function consequenciaDosDiferenciais(texto: string): string {
  if (texto === "") return EM_BRANCO;
  return "A Helô tem isto à mão para usar quando a conversa pedir um motivo para escolher este cliente.";
}

export function consequenciaDasInformacoesAEvitar(texto: string): string {
  if (texto === "") {
    return "Nada registrado. A Helô segue só com as proibições que já valem para todos os clientes.";
  }
  return "Isto é uma proibição, e fica perto do topo do prompt, junto das travas: restrição no fim de um prompt longo é obedecida menos que no começo.";
}

export function consequenciaDasObservacoes(texto: string): string {
  if (texto === "") {
    return "Nada registrado. É o campo para o que não cabe nos outros — se não houver nada, não falta nada.";
  }
  return "A Helô lê isto na seção de como este cliente quer ser atendido, depois do objetivo e da prioridade comercial.";
}

export function consequenciaDaHistoria(texto: string): string {
  if (texto === "") return EM_BRANCO;
  return "A Helô pode contar a história do cliente quando a conversa abrir espaço. Ela não inventa nada além do que está escrito aqui.";
}

/** "Pix, Dinheiro e Boleto" — vírgula até o penúltimo, "e" no último. */
function listar(itens: readonly string[]): string {
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * As três frases do resumo da aba Visão Geral.
 *
 * São as mesmas consequências de cima, escolhidas por serem as que mais mudam a
 * conversa: para onde a Helô conduz, o que ela faz com valor, e o que ela tem
 * proibido dizer. Um resumo que repetisse os dezoito campos não seria resumo.
 */
export function resumoDaEstrategia(ficha: FichaDaEstrategia): {
  rotulo: string;
  frase: string;
}[] {
  return [
    {
      rotulo: "Para onde a Helô conduz",
      frase: consequenciaDoObjetivo(ficha.objetivo),
    },
    {
      rotulo: "O que ela faz quando o assunto é valor",
      frase: consequenciaDaPoliticaDeValores(
        ficha.politicaDeValores,
        ficha.heloPodeInformarValor,
      ),
    },
    {
      rotulo: "O que ela tem proibido dizer",
      frase: consequenciaDasInformacoesAEvitar(ficha.informacoesAEvitar),
    },
  ];
}
