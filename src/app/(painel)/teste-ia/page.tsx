import Cabecalho from "@/components/Cabecalho";
import SimuladorIa from "@/components/SimuladorIa";
import { exigirHervalAdmin } from "@/lib/autorizacao";

export default async function PaginaTesteIa() {
  // Tela exclusiva da Herval. Ver `exigirHervalAdmin`.
  await exigirHervalAdmin();

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
