import Cabecalho from "@/components/Cabecalho";
import TabelaTarefas from "@/components/TabelaTarefas";
import { exigirHervalAdmin } from "@/lib/autorizacao";

export default async function PaginaFilaDeTarefas() {
  // Tela exclusiva da Herval: a fila é de quem atende várias clínicas, não de
  // uma clínica só. Ver `exigirHervalAdmin`.
  await exigirHervalAdmin();

  return (
    <>
      <Cabecalho
        titulo="Fila de Tarefas"
        descricao="O que a Helô sinalizou e o que o CRC marcou para fazer, com prazo."
      />
      <TabelaTarefas />
    </>
  );
}
