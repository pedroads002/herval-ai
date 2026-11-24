/**
 * A venda do lead: o formato que a tela usa e a conferência do que ela pede
 * para gravar.
 *
 * Mora fora de `acoes/vendas.ts` pelo mesmo motivo de `linhaDoFunil.ts`: um
 * arquivo `"use server"` só exporta função assíncrona, e aqui há tipo, constante
 * e conta síncrona que a tela também usa (formatar o valor, ler o que foi
 * digitado). Nada aqui fala com o banco.
 *
 * O valor volta ao painel depois do #45, que tirou todo dinheiro da tela. Lá o
 * corte foi de preço e orçamento; aqui é o que o paciente pagou de fato, pedido
 * pela Herval para mostrar o retorno da Helô ao cliente.
 */

/** Uma venda como a tela mostra e edita. */
export type VendaDoLead = {
  id: number;
  leadId: number;
  /** Em reais, com centavos. Sempre maior que zero. */
  valor: number;
  procedimento: string;
  /** "2026-11-24", no dia de Brasília. */
  dataVenda: string;
  formaPagamento: string | null;
  parcelas: number | null;
  observacao: string | null;
  registradoPorNome: string | null;
};

/** A linha de `vendas` como o PostgREST devolve. `numeric` vem como texto. */
export type LinhaDeVenda = {
  id: number;
  lead_id: number;
  valor: number | string;
  procedimento: string;
  data_venda: string;
  forma_pagamento: string | null;
  parcelas: number | null;
  observacao: string | null;
  registrado_por_nome: string | null;
};

export const CAMPOS_DA_VENDA =
  "id, lead_id, valor, procedimento, data_venda, forma_pagamento, parcelas, observacao, registrado_por_nome";

export function montarVenda(linha: LinhaDeVenda): VendaDoLead {
  return {
    id: linha.id,
    leadId: linha.lead_id,
    valor: Number(linha.valor),
    procedimento: linha.procedimento,
    dataVenda: linha.data_venda,
    formaPagamento: linha.forma_pagamento,
    parcelas: linha.parcelas,
    observacao: linha.observacao,
    registradoPorNome: linha.registrado_por_nome,
  };
}

/** O que a tela manda para gravar. Tudo texto, como sai do formulário. */
export type VendaDoFormulario = {
  /** Ausente ao registrar; presente ao corrigir. */
  id?: number;
  leadId: number;
  valor: string;
  procedimento: string;
  dataVenda: string;
  formaPagamento: string;
  parcelas: string;
  observacao: string;
};

/** A venda já conferida, pronta para virar linha. */
export type VendaConferida = {
  id: number | null;
  lead_id: number;
  valor: number;
  procedimento: string;
  data_venda: string;
  forma_pagamento: string | null;
  parcelas: number | null;
  observacao: string | null;
};

/**
 * Lê o valor do jeito que a equipe digita: "1.500", "1500,50", "R$ 2.000,00",
 * "1500.5". Devolve `null` quando não dá para ter certeza do número.
 *
 * A regra do separador: vírgula é sempre decimal. Sem vírgula, ponto seguido de
 * exatamente três dígitos é milhar ("1.500" = mil e quinhentos); com um ou dois
 * dígitos depois, é decimal ("1500.5"). É o que um brasileiro quer dizer em
 * cada caso, e errar aqui multiplicaria a venda por mil.
 */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (limpo === "") return null;

  let normal: string;
  if (limpo.includes(",")) {
    normal = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    normal = limpo.replace(/\./g, "");
  } else {
    normal = limpo;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  const numero = Number(normal);
  return Number.isFinite(numero) ? numero : null;
}

const formatoReais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarReais(valor: number): string {
  return formatoReais.format(valor);
}

/** "2026-11-24" → "24/11/2026", sem passar por `Date` (que leria UTC). */
export function formatarDataDaVenda(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

/** Hoje em Brasília, no formato do campo de calendário. */
export function hojeEmBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** Maior valor aceito: um teto de digitação, não de negócio. */
const VALOR_MAXIMO = 9_999_999_999.99;

export function conferirVenda(
  venda: VendaDoFormulario,
): { erro: string } | { venda: VendaConferida } {
  if (!Number.isInteger(venda.leadId) || venda.leadId <= 0) {
    return { erro: "Lead inválido." };
  }
  if (venda.id !== undefined && (!Number.isInteger(venda.id) || venda.id <= 0)) {
    return { erro: "Venda inválida." };
  }

  const valor = lerValor(venda.valor);
  if (valor === null) {
    return { erro: "Informe o valor pago, por exemplo 1.500,00." };
  }
  if (valor <= 0) return { erro: "O valor pago precisa ser maior que zero." };
  if (valor > VALOR_MAXIMO) return { erro: "Confira o valor: ficou alto demais." };

  const procedimento = venda.procedimento.trim();
  if (procedimento === "") return { erro: "Informe o procedimento vendido." };
  if (procedimento.length > 120) {
    return { erro: "O nome do procedimento passou de 120 letras." };
  }

  const data = venda.dataVenda.trim() || hojeEmBrasilia();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { erro: "Data da venda inválida." };
  }
  if (data > hojeEmBrasilia()) {
    return { erro: "A data da venda não pode ser depois de hoje." };
  }

  const forma = venda.formaPagamento.trim();
  if (forma.length > 60) return { erro: "Forma de pagamento longa demais." };

  let parcelas: number | null = null;
  if (venda.parcelas.trim() !== "") {
    parcelas = Number(venda.parcelas);
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48) {
      return { erro: "Parcelas: um número de 1 a 48." };
    }
  }

  const observacao = venda.observacao.trim();
  if (observacao.length > 500) {
    return { erro: "A observação passou de 500 letras." };
  }

  return {
    venda: {
      id: venda.id ?? null,
      lead_id: venda.leadId,
      valor: Math.round(valor * 100) / 100,
      procedimento,
      data_venda: data,
      forma_pagamento: forma || null,
      parcelas,
      observacao: observacao || null,
    },
  };
}

/** Soma das vendas, em centavos para não acumular erro de vírgula. */
export function somarVendas(vendas: { valor: number }[]): number {
  return vendas.reduce((total, v) => total + Math.round(v.valor * 100), 0) / 100;
}
