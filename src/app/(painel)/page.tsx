import Cabecalho from "@/components/Cabecalho";
import TabelaTarefas from "@/components/TabelaTarefas";

export default function PaginaFilaDeTarefas() {
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
