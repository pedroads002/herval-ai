import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import PainelAgenda from "@/components/PainelAgenda";
import { carregarAgenda } from "@/lib/dados/agenda";

/**
 * A Agenda.
 *
 * Passou a ler o banco: as consultas moram em `agendamentos`, e quem atende sai
 * do cadastro de Clientes. Antes desta tela era tudo memória do navegador, e
 * recarregar a página apagava o que a equipe tinha marcado.
 *
 * Sem `export const dynamic`, pelo mesmo motivo de Clientes e Procedimentos: a
 * leitura passa pelo cliente do Supabase, que lê os cookies da sessão, e isso já
 * torna a página dinâmica.
 */
export default async function PaginaAgenda() {
  const { aviso, ...dados } = await carregarAgenda();

  return (
    <>
      <Cabecalho
        titulo="Agenda"
        descricao="Consultas dos leads que já estão em Agendamento, Reagendamento ou Comparecimento no Funil."
      />
      <AvisoDeCorte aviso={aviso} />
      <PainelAgenda {...dados} />
    </>
  );
}
