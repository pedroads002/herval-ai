/**
 * Quantas configurações da estratégia estão preenchidas, e quais faltam.
 *
 * Existe para a aba Visão Geral poder dizer "11 de 16 configurações
 * preenchidas" em vez de obrigar quem usa a abrir os cinco blocos para
 * descobrir onde está o buraco.
 *
 * Duas regras fazem a conta valer algo:
 *
 * **Campo que perdeu sentido sai do total.** Quem respondeu que não tem
 * avaliação inicial não deve ser cobrado pelo tipo dela nem por quando ela é
 * cobrada. Sem isso, 100% seria inalcançável para metade dos clientes, e uma
 * barra que nunca enche é uma barra que ninguém olha.
 *
 * **Campo em que o branco é resposta não entra na conta.** "Informações a
 * evitar" vazio quer dizer "não há nada além do que já é proibido para todos", e
 * isso é uma resposta completa — o prompt da Helô trata assim. Cobrar esses dois
 * campos faria o painel pedir texto inventado só para a barra fechar.
 *
 * Puro de propósito, como `fichaDaEstrategia.ts`: sem sessão, sem banco, sem
 * React. Dá para conferir a conta rodando a função.
 */

import type {
  BlocoDaEstrategia,
  FichaDaEstrategia,
} from "@/lib/dados/fichaDaEstrategia";

export type ItemDaEstrategia = {
  rotulo: string;
  bloco: BlocoDaEstrategia;
  preenchido: boolean;
};

export type Completude = {
  itens: ItemDaEstrategia[];
  preenchidas: number;
  total: number;
  /** De 0 a 100, já arredondado. 100 só quando nada falta. */
  porcento: number;
  /** O primeiro bloco com algo faltando, para o botão de editar saber onde abrir. */
  primeiroBlocoIncompleto: BlocoDaEstrategia | null;
};

export function conferirCompletude(ficha: FichaDaEstrategia): Completude {
  const itens: ItemDaEstrategia[] = [];

  const item = (
    rotulo: string,
    bloco: BlocoDaEstrategia,
    preenchido: boolean,
  ) => itens.push({ rotulo, bloco, preenchido });

  item("Objetivo principal", "objetivo", ficha.objetivo !== null);
  item("Prioridade comercial", "objetivo", ficha.prioridade !== null);

  item(
    "Tem avaliação inicial",
    "avaliacao",
    ficha.temAvaliacaoInicial !== null,
  );

  /*
    Respondeu "não tem avaliação"? Então tipo, gratuidade, cobrança e abatimento
    não são lacunas — são perguntas que deixaram de existir. Nulo continua
    cobrando, porque nulo é "ninguém respondeu ainda".
  */
  if (ficha.temAvaliacaoInicial !== false) {
    item("Tipo de avaliação", "avaliacao", ficha.tipoDeAvaliacao !== null);
    item(
      "A avaliação é gratuita",
      "avaliacao",
      ficha.avaliacaoGratuita !== null,
    );

    // Gratuita não é cobrada nunca, e o que não é cobrado não abate nada.
    if (ficha.avaliacaoGratuita !== true) {
      item("Quando é cobrada", "avaliacao", ficha.quandoCobrada !== null);
      item(
        "Abate no procedimento",
        "avaliacao",
        ficha.avaliacaoAbateNoProcedimento !== null,
      );
    }
  }

  item(
    "A Helô pode falar de valor",
    "avaliacao",
    ficha.heloPodeInformarValor !== null,
  );

  item("Formas de pagamento", "comercial", ficha.formasDePagamento.length > 0);
  item("Parcelamento máximo", "comercial", ficha.parcelamentoMaximo !== null);
  item("Convênios", "comercial", ficha.convenios.length > 0);
  item("Política de valores", "comercial", ficha.politicaDeValores !== null);

  item("Classe econômica", "publico", ficha.classes.length > 0);
  item(
    "Faixa etária",
    "publico",
    ficha.faixaEtariaDe !== null || ficha.faixaEtariaAte !== null,
  );
  item("Principais dores", "publico", ficha.principaisDores.length > 0);

  item("Tom predominante", "comunicacao", ficha.tomPredominante !== "");
  item("Diferenciais", "comunicacao", ficha.diferenciais !== "");
  item("História", "comunicacao", ficha.historia !== "");

  /*
    "Informações a evitar" e "Observações de atendimento" ficam fora da conta de
    propósito: vazio neles é uma resposta, não uma lacuna. Eles continuam
    editáveis no bloco de comunicação, só não cobram nada de ninguém.
  */

  const preenchidas = itens.filter((i) => i.preenchido).length;
  const total = itens.length;
  const faltando = itens.find((i) => !i.preenchido);

  return {
    itens,
    preenchidas,
    total,
    porcento: total === 0 ? 100 : Math.round((preenchidas / total) * 100),
    primeiroBlocoIncompleto: faltando?.bloco ?? null,
  };
}
