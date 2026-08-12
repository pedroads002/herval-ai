import Cabecalho from "@/components/Cabecalho";
import PainelAgenda from "@/components/PainelAgenda";

export default function PaginaAgenda() {
  return (
    <>
      <Cabecalho
        titulo="Agenda"
        descricao="Consultas dos leads que já estão em Agendamento, Reagendamento ou Comparecimento no Funil."
      />
      <PainelAgenda />
    </>
  );
}
