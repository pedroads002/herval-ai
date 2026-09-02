import Cabecalho from "@/components/Cabecalho";
import ListaAtendimentos from "@/components/ListaAtendimentos";

/**
 * A porta de entrada do atendimento. Antes só se chegava aqui pelo card do
 * Funil, o que obrigava a equipe a procurar o lead no pipeline para conversar
 * com ele — a tela de conversa existia, mas não tinha endereço próprio.
 *
 * Não é uma segunda fila: não mede nada, não repete número de relatório. É só
 * a ordem em que as conversas pedem resposta.
 */
export default function PaginaAtendimento() {
  return (
    <>
      <Cabecalho
        titulo="Atendimento"
        descricao="As conversas da fila, de quem espera há mais tempo para quem já foi respondido."
      />
      <ListaAtendimentos />
    </>
  );
}
