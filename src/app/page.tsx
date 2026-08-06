import Cabecalho from "@/components/Cabecalho";
import TabelaTarefas from "@/components/TabelaTarefas";

export default function PaginaFilaDeTarefas() {
  return (
    <>
      <Cabecalho
        titulo="Fila de Tarefas"
        descricao="Ações sugeridas pela IA aguardando aprovação humana."
      />
      <TabelaTarefas />
    </>
  );
}
