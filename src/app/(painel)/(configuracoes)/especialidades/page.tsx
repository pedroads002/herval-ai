import Cabecalho from "@/components/Cabecalho";
import ListaEspecialidades from "@/components/ListaEspecialidades";

export default function PaginaEspecialidades() {
  return (
    <>
      <Cabecalho
        titulo="Especialidades"
        descricao="Categorias de atendimento, valor da avaliação e como a IA deve falar de cada uma."
      />
      <ListaEspecialidades />
    </>
  );
}
