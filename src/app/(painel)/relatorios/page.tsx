import Cabecalho from "@/components/Cabecalho";
import PainelRelatorios from "@/components/PainelRelatorios";

export default function PaginaRelatorios() {
  return (
    <>
      <Cabecalho
        titulo="Relatórios"
        descricao="Desempenho comercial de todas as clínicas atendidas, por período."
      />
      <PainelRelatorios />
    </>
  );
}
