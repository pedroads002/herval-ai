import Cabecalho from "@/components/Cabecalho";
import TabelaTarefas from "@/components/TabelaTarefas";
import { exigirTela, TELAS_CONTROLAVEIS } from "@/lib/autorizacao";

export default async function PaginaFilaDeTarefas() {
  // A Herval vê a fila de todas as clínicas; o cliente vê só a da própria.
  // Quem recorta é o banco, não esta tela: as políticas de `tarefas`, `leads`
  // e `mensagens` só devolvem e só deixam gravar linha de lead da operação de
  // quem está logado (`lead_na_operacao`). Por isso a mesma tela serve aos dois.
  //
  // O colaborador (`cliente_operacional`) entra só se tiver Conversas liberada:
  // abrir uma tarefa mostra a conversa do lead, e sem esta amarra a Fila viraria
  // um caminho para ler conversa que o `cliente_admin` não liberou para ele.
  await exigirTela(TELAS_CONTROLAVEIS.ATENDIMENTO);

  return (
    <>
      <Cabecalho
        titulo="Fila de Tarefas"
        descricao="O que a Helô sinalizou e o que o CRC marcou para fazer, com prazo."
      />
      <TabelaTarefas />
    </>
  );
}
