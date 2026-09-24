import Cabecalho from "@/components/Cabecalho";
import ListaAtendimentos from "@/components/ListaAtendimentos";
import AtualizacaoAutomatica from "@/components/AtualizacaoAutomatica";
import { carregarAtendimento } from "@/lib/dados/atendimento";

/**
 * A porta de entrada do atendimento. Antes só se chegava aqui pelo card do
 * Funil, o que obrigava a equipe a procurar o lead no pipeline para conversar
 * com ele — a tela de conversa existia, mas não tinha endereço próprio.
 *
 * Não é uma segunda fila: não mede nada, não repete número de relatório. É só
 * a ordem em que as conversas pedem resposta.
 *
 * **Esta é a primeira tela do painel que lê o banco.** As outras (Funil,
 * Agenda, Relatórios, Fila de Tarefas) seguem com dado de exemplo. A tarja no
 * topo existe por causa disso: duas telas mostrando listas diferentes sem
 * aviso levariam o CRC a achar que uma delas está errada.
 *
 * Não há `export const dynamic` aqui de propósito: a leitura passa pelo cliente
 * do Supabase, que lê os cookies da sessão, e isso já torna a página dinâmica.
 * A opção `dynamic` está em via de saída no Next (some quando Cache Components
 * é ligado), então depender dela seria dívida na certa.
 */
export default async function PaginaAtendimento() {
  const { leads, mensagens, falha } = await carregarAtendimento();

  return (
    <>
      <Cabecalho
        titulo="Atendimento"
        descricao="As conversas da fila, de quem espera há mais tempo para quem já foi respondido."
      />

      <p className="mb-6 rounded-card border border-herval-verde/40 bg-herval-verde/10 px-5 py-3 text-sm font-medium text-herval-preto">
        <span className="font-extrabold">Conversas reais.</span> Esta tela lê o
        banco de dados. As outras telas do painel ainda mostram dados de
        exemplo, então os números não vão bater entre elas.
      </p>

      <AtualizacaoAutomatica />
      <ListaAtendimentos leads={leads} mensagens={mensagens} falha={falha} />
    </>
  );
}
