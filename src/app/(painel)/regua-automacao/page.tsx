import Cabecalho from "@/components/Cabecalho";
import TabelaRegua from "@/components/TabelaRegua";

export default function PaginaReguaAutomacao() {
  return (
    <>
      <Cabecalho
        titulo="Régua de Automação"
        descricao="Gatilhos, condições e prazos que colocam cada tarefa na fila."
      />
      <TabelaRegua />
    </>
  );
}
