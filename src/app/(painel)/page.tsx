import { redirect } from "next/navigation";

/**
 * A raiz do painel. Não é tela própria — é o destino de quem abre o site sem
 * vir de lugar nenhum (link da Vercel, aba nova com sessão já salva, etc.).
 *
 * Visão Geral é a primeira seção do menu e já é para onde o login leva (ver
 * `FormularioLogin.tsx`); a raiz tinha ficado destoando, com o conteúdo da
 * Fila de Tarefas direto nela — resquício de quando aquela era a tela inicial,
 * antes de existir Visão Geral. A Fila de Tarefas continua existindo, só que
 * na sua própria rota: `/fila-de-tarefas`.
 */
export default function RaizDoPainel() {
  redirect("/visao-geral");
}
