import Cabecalho from "@/components/Cabecalho";
import TabelaRegua from "@/components/TabelaRegua";
import { exigirHervalAdmin } from "@/lib/autorizacao";

export default async function PaginaReguaAutomacao() {
  // Tela exclusiva da Herval. Ver `exigirHervalAdmin`.
  await exigirHervalAdmin();

  return (
    <>
      <Cabecalho
        titulo="Régua de Automação"
        descricao="Gatilhos, condições e prazos que colocam cada tarefa na fila."
      />
      <TabelaRegua />
    </>
  );
}
