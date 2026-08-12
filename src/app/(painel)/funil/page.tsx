import Cabecalho from "@/components/Cabecalho";
import PainelFunil from "@/components/PainelFunil";

export default function PaginaFunil() {
  return (
    <>
      <Cabecalho
        titulo="Funil"
        descricao="Todos os leads da base distribuídos pelas etapas do pipeline."
      />
      <PainelFunil />
    </>
  );
}
