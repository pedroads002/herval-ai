/**
 * A conversão de uma linha de `leads` no card que o Funil desenha, e a
 * conferência do que a tela pede para gravar.
 *
 * Mora fora de `dados/funil.ts` e de `acoes/funil.ts` pelo mesmo motivo de
 * `consultaDoFormulario.ts` e `expedienteDaConsulta.ts`: aqui não há sessão nem
 * banco no caminho, então cada regra pode ser conferida uma por uma, sem precisar
 * estar logado. Um arquivo `"use server"` também não poderia exportar o tipo nem a
 * função síncrona que estão aqui.
 */

import {
  ETAPA_PERDIDA,
  etapasFunil,
  motivosDePerda,
  type EtapaFunil,
  type MotivoPerda,
} from "@/data/leads";

/** O lead como o quadro do Funil precisa dele. */
export type LeadDoFunil = {
  id: number;
  nome: string;
  /** Já pronto para leitura. Vazio virou "Sem telefone". */
  telefone: string;
  etapa: EtapaFunil;
  /** Nulo quando ninguém registrou por onde o lead chegou. */
  origem: string | null;
  /** Nome do cliente da agência a que o lead pertence. */
  cliente: string | null;
  /** Dias inteiros de calendário desde que o lead chegou. Hoje é 0. */
  diasAtras: number;
  motivoPerda: MotivoPerda | null;
  /** Quantas vezes a consulta deste lead foi remarcada depois de uma falta. */
  remarcacoes: number;
};

/** A linha de `leads` como o PostgREST devolve: tudo texto, tudo anulável. */
export type LinhaDeLead = {
  id: number;
  nome: string | null;
  telefone: string | null;
  etapa: string;
  origem: string | null;
  criado_em: string;
  motivo_perda: string | null;
  clinica_id: number | null;
};

export type ContextoDoFunil = {
  /** Contra o que os dias de chegada são contados. */
  hoje: Date;
  /** Nome do cliente por id, já lido de `clinicas`. */
  clientes: Map<number, string>;
  /** Quantas faltas cada lead tem em `agendamentos`. */
  faltas: Map<number, number>;
};

/**
 * Devolve o card, ou `null` quando a etapa do lead não tem coluna no quadro.
 *
 * Nulo não é erro: é o lead que o quadro não sabe onde desenhar. Quem chama
 * transforma isso em aviso na tela, porque lead que desaparece sem explicação é
 * pior que lead de fora do quadro declarado.
 */
export function montarLeadDoFunil(
  linha: LinhaDeLead,
  contexto: ContextoDoFunil,
): LeadDoFunil | null {
  const etapa = etapaValida(linha.etapa);
  if (etapa === null) return null;

  return {
    id: linha.id,
    nome: (linha.nome ?? "").trim() || "Lead sem nome",
    telefone: (linha.telefone ?? "").trim() || "Sem telefone",
    etapa,
    origem: (linha.origem ?? "").trim() || null,
    cliente:
      linha.clinica_id === null
        ? null
        : (contexto.clientes.get(linha.clinica_id) ?? null),
    diasAtras: diasDesde(linha.criado_em, contexto.hoje),
    motivoPerda: motivoValido(linha.motivo_perda),
    remarcacoes: contexto.faltas.get(linha.id) ?? 0,
  };
}

/**
 * A etapa vem do banco como texto, e o cérebro no n8n também escreve nela.
 * Confiar sem conferir deixaria uma etapa desconhecida ser comparada com as
 * colunas do quadro e o lead sumir sem ninguém saber por quê.
 */
export function etapaValida(valor: string): EtapaFunil | null {
  return (etapasFunil as string[]).includes(valor)
    ? (valor as EtapaFunil)
    : null;
}

/** O CHECK da coluna já fecha a lista, mas o tipo que volta do PostgREST é texto. */
export function motivoValido(valor: string | null): MotivoPerda | null {
  if (valor === null) return null;
  return (motivosDePerda as string[]).includes(valor)
    ? (valor as MotivoPerda)
    : null;
}

/**
 * Dias inteiros de calendário, não de vinte e quatro horas: quem chegou ontem às
 * 23h chegou "1 dia atrás" para quem olha a tela, mesmo que tenham passado duas
 * horas. É a mesma conta que o filtro "Chegaram hoje" espera.
 */
export function diasDesde(criadoEm: string, hoje: Date): number {
  const chegada = new Date(criadoEm);
  if (Number.isNaN(chegada.getTime())) return 0;

  const meiaNoiteDaChegada = new Date(
    chegada.getFullYear(),
    chegada.getMonth(),
    chegada.getDate(),
  );
  const meiaNoiteDeHoje = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
  );

  const dias = Math.round(
    (meiaNoiteDeHoje.getTime() - meiaNoiteDaChegada.getTime()) / 86_400_000,
  );

  // Lead com data no futuro (fuso do servidor à frente do nosso) conta como hoje.
  return dias < 0 ? 0 : dias;
}

/** O movimento que a tela pediu, já conferido contra as listas fechadas. */
export type MovimentoConferido = {
  etapa: EtapaFunil;
  motivo: MotivoPerda | null;
};

/**
 * Confere o que a tela mandou mover, antes de qualquer gravação.
 *
 * Uma ação de servidor é um endereço POST como outro qualquer: a tela já cobra o
 * motivo antes de aceitar Venda Perdida, e a recusa aqui é o que garante que a
 * regra vale mesmo quando o pedido não vem da tela.
 */
export function conferirMovimento(
  leadId: number,
  destino: string,
  motivoPerda: string | null,
): { erro: string } | MovimentoConferido {
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return { erro: "Não deu para saber qual lead mover." };
  }

  const etapa = etapaValida(destino);
  if (etapa === null) return { erro: "Essa etapa não existe no funil." };

  if (etapa !== ETAPA_PERDIDA) return { etapa, motivo: null };

  // Venda Perdida sem motivo é o lead que ninguém consegue explicar depois — e o
  // motivo é o que alimenta o card "Motivos de perda" da Visão Geral.
  if (motivoPerda === null || motivoPerda === "") {
    return { erro: "Escolha o motivo da perda antes de mover o lead." };
  }

  const motivo = motivoValido(motivoPerda);
  if (motivo === null) {
    return { erro: "Esse motivo de perda não existe na lista." };
  }

  return { etapa, motivo };
}
