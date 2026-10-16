import Cabecalho from "@/components/Cabecalho";
import GerenciadorObjecoes from "@/components/GerenciadorObjecoes";
import { exigirHervalAdmin } from "@/lib/autorizacao";

export default async function PaginaObjecoes() {
  // Tela exclusiva da Herval. Ver `exigirHervalAdmin`.
  await exigirHervalAdmin();

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
