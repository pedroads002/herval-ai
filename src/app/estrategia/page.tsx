import Cabecalho from "@/components/Cabecalho";
import FormularioEstrategia from "@/components/FormularioEstrategia";

export default function PaginaEstrategia() {
  return (
    <>
      <Cabecalho
        titulo="Estratégia da Clínica"
        descricao="Informações que orientam o tom e os argumentos usados pela IA."
      />
      <FormularioEstrategia />
    </>
  );
}
