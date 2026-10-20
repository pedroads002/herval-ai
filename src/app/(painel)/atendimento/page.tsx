import Cabecalho from "@/components/Cabecalho";
import ListaAtendimentos from "@/components/ListaAtendimentos";
import AtualizacaoAutomatica from "@/components/AtualizacaoAutomatica";
import { carregarAtendimento } from "@/lib/dados/atendimento";
import { carregarAutorizacao, exigirTela, TELAS_CONTROLAVEIS } from "@/lib/autorizacao";

/**
 * A porta de entrada do atendimento. Antes só se chegava aqui pelo card do
 * Funil, o que obrigava a equipe a procurar o lead no pipeline para conversar
 * com ele — a tela de conversa existia, mas não tinha endereço próprio.
 *
 * Não é uma segunda fila: não mede nada, não repete número de relatório. É só
 * a ordem em que as conversas pedem resposta.
 *
 * Esta foi a primeira tela do painel a ler o banco; hoje Visão Geral, Funil,
 * Agenda, Relatórios, Fila de Tarefas e Quebra de Objeções já leem também —
 * e dentro desta própria tela, as abas Agenda e Ligações do Atendimento (em
 * `/atendimento/[id]`) também já leem o banco. Só Régua de Automação e
 * Templates de WhatsApp ainda seguem com dado de exemplo, enquanto essas
 * seções não são configuradas. Teste da IA é caso aparte: o roteiro ali é
 * fixo de propósito (ver `data/testeIa.ts`) — é um simulador didático, não
 * uma tela de cadastro, então não há "dado real" para ligar nela. A tarja
 * que avisava "os números não vão bater entre elas" foi embora porque deixou
 * de ser verdade para a maior parte do painel — ela voltaria a fazer
 * sentido, de forma recortada, quando entrarmos nas telas que faltam.
 *
 * `exigirTela` é nova aqui: até agora esta era a única das quatro telas
 * opcionais sem nenhuma chamada a `carregarAutorizacao()`, porque nada nela
 * dependia de quem está logado — só passou a precisar quando um colaborador
 * ganhou a possibilidade de não ter Conversas liberado. Vai junto no mesmo
 * `Promise.all` da leitura do atendimento, para não virar uma segunda ida ao
 * banco em série.
 *
 * Não há `export const dynamic` aqui de propósito: a leitura passa pelo cliente
 * do Supabase, que lê os cookies da sessão, e isso já torna a página dinâmica.
 * A opção `dynamic` está em via de saída no Next (some quando Cache Components
 * é ligado), então depender dela seria dívida na certa.
 */
export default async function PaginaAtendimento() {
  const [{ leads, mensagens, falha }, autorizacao] = await Promise.all([
    carregarAtendimento(),
    carregarAutorizacao(),
  ]);

  await exigirTela(TELAS_CONTROLAVEIS.ATENDIMENTO, autorizacao);

  return (
    <>
      <Cabecalho
        titulo="Atendimento"
        descricao="As conversas da fila, de quem espera há mais tempo para quem já foi respondido."
      />

      <AtualizacaoAutomatica />
      <ListaAtendimentos leads={leads} mensagens={mensagens} falha={falha} />
    </>
  );
}
