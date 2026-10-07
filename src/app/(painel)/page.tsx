import Cabecalho from "@/components/Cabecalho";
import TabelaTarefas from "@/components/TabelaTarefas";

export default function PaginaFilaDeTarefas() {
  return (
    <>
      <Cabecalho
        titulo="Fila de Tarefas"
        descricao="O que a Helô sinalizou e o que a equipe marcou para fazer, com prazo."
      />
      <TabelaTarefas />
    </>
  );
}
