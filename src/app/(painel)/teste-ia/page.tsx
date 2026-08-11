import Cabecalho from "@/components/Cabecalho";
import SimuladorIa from "@/components/SimuladorIa";

export default function PaginaTesteIa() {
  return (
    <>
      <Cabecalho
        titulo="Teste da IA"
        descricao="Simule uma conversa e veja como a IA responderia, sem falar com ninguém."
      />
      <SimuladorIa />
    </>
  );
}
