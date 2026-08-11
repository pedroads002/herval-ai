import Cabecalho from "@/components/Cabecalho";
import GerenciadorObjecoes from "@/components/GerenciadorObjecoes";

export default function PaginaObjecoes() {
  return (
    <>
      <Cabecalho
        titulo="Quebra de Objeções"
        descricao="Respostas padrão usadas pela IA e pela equipe no atendimento."
      />
      <GerenciadorObjecoes />
    </>
  );
}
