import Cabecalho from "@/components/Cabecalho";
import GerenciadorObjecoes from "@/components/GerenciadorObjecoes";

export default function PaginaObjecoes() {
  return (
    <>
      <Cabecalho
        titulo="Quebra de Objeções"
        descricao="Respostas padrão usadas pela Helô e pelo CRC no atendimento."
      />
      <GerenciadorObjecoes />
    </>
  );
}
