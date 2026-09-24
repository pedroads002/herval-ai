/**
 * Busca e filtro por situação, compartilhados pelas telas que listam leads.
 *
 * Moram aqui, e não dentro de cada tela, porque são a mesma pergunta feita em
 * dois lugares: "Agendados" precisa querer dizer a mesma coisa na Fila de
 * Tarefas e no Atendimento. Enquanto a regra estava escrita duas vezes, nada
 * impedia as telas de discordarem sobre o mesmo lead.
 */
import { situacaoDaEtapa, situacoesAtivas } from "@/data/tarefas";
import type { EtapaFunil } from "@/data/leads";

/**
 * O mínimo que um lead precisa ter para ser buscado e filtrado.
 *
 * É um formato estreito de propósito: a Fila de Tarefas passa uma `Tarefa`
 * inteira e o Atendimento passa um lead lido do banco, que não tem regra nem
 * score. Os dois satisfazem isto, então a regra continua escrita uma vez só.
 *
 * `clinica` chega com o nome já resolvido, e não como id. Antes o nome era
 * buscado aqui dentro, na lista fixa de clínicas — o que amarrava a busca ao
 * dado de exemplo e impedia o Atendimento de buscar pela clínica real.
 */
export type LeadFiltravel = {
  lead: string;
  telefone: string;
  clinica: string;
  etapa: EtapaFunil;
};

export const filtrosDeSituacao = [
  "Ativos",
  "Todos",
  "Pendentes",
  "Em Atendimento",
  "Aguardando Resposta",
  "Agendados",
  "Ganhos",
  "Desqualificados",
] as const;

export type FiltroDeSituacao = (typeof filtrosDeSituacao)[number];

/** Nome, telefone ou clínica. O termo já vem em minúsculas e sem espaços. */
export function combinaComBusca(lead: LeadFiltravel, termo: string) {
  if (termo === "") return true;
  return (
    lead.lead.toLowerCase().includes(termo) ||
    lead.telefone.toLowerCase().includes(termo) ||
    lead.clinica.toLowerCase().includes(termo)
  );
}

/**
 * A situação sai da etapa do Funil, e não de um campo próprio — por isso
 * mover um card no Funil muda o que estas listas mostram, na hora.
 */
export function combinaComFiltro(lead: LeadFiltravel, filtro: FiltroDeSituacao) {
  if (filtro === "Todos") return true;

  const situacao = situacaoDaEtapa(lead.etapa);

  switch (filtro) {
    case "Ativos":
      return situacoesAtivas.includes(situacao);
    case "Pendentes":
      return situacao === "Pendente";
    case "Agendados":
      return situacao === "Agendado";
    case "Ganhos":
      return situacao === "Ganho";
    case "Desqualificados":
      return situacao === "Desqualificado";
    default:
      // "Em Atendimento" e "Aguardando Resposta" têm o mesmo nome da situação.
      return situacao === filtro;
  }
}
