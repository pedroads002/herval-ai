/**
 * Busca e filtro por situação, compartilhados pelas telas que listam leads.
 *
 * Moram aqui, e não dentro de cada tela, porque são a mesma pergunta feita em
 * dois lugares: "Agendados" precisa querer dizer a mesma coisa na Fila de
 * Tarefas e no Atendimento. Enquanto a regra estava escrita duas vezes, nada
 * impedia as telas de discordarem sobre o mesmo lead.
 */
import { nomeDaClinica } from "@/data/clinicas";
import { situacaoDaEtapa, situacoesAtivas, type Tarefa } from "@/data/tarefas";

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
export function combinaComBusca(tarefa: Tarefa, termo: string) {
  if (termo === "") return true;
  return (
    tarefa.lead.toLowerCase().includes(termo) ||
    tarefa.telefone.toLowerCase().includes(termo) ||
    nomeDaClinica(tarefa.clinicaId).toLowerCase().includes(termo)
  );
}

/**
 * A situação sai da etapa do Funil, e não de um campo próprio — por isso
 * mover um card no Funil muda o que estas listas mostram, na hora.
 */
export function combinaComFiltro(tarefa: Tarefa, filtro: FiltroDeSituacao) {
  if (filtro === "Todos") return true;

  const situacao = situacaoDaEtapa(tarefa.etapa);

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
