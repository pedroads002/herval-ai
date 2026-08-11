import Cabecalho from "@/components/Cabecalho";
import PainelVisaoGeral from "@/components/PainelVisaoGeral";

export default function PaginaVisaoGeral() {
  return (
    <>
      <Cabecalho
        titulo="Visão Geral"
        descricao="Resultado da operação comercial no período selecionado."
      />
      <PainelVisaoGeral />
    </>
  );
}
