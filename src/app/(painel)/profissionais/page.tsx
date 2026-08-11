import Cabecalho from "@/components/Cabecalho";
import TabelaProfissionais from "@/components/TabelaProfissionais";

export default function PaginaProfissionais() {
  return (
    <>
      <Cabecalho
        titulo="Profissionais"
        descricao="Quem atende na clínica e quais especialidades cada um cobre."
      />
      <TabelaProfissionais />
    </>
  );
}
