import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import PainelAgenda from "@/components/PainelAgenda";
import { carregarAgenda } from "@/lib/dados/agenda";
import { carregarAutorizacao, exigirTela, TELAS_CONTROLAVEIS } from "@/lib/autorizacao";

/**
 * A Agenda.
 *
 * Passou a ler o banco: as consultas moram em `agendamentos`, e quem atende sai
 * do cadastro de Clientes. Antes desta tela era tudo memória do navegador, e
 * recarregar a página apagava o que a equipe tinha marcado.
 *
 * `exigirTela` é nova aqui, pelo mesmo motivo do Atendimento: esta tela não
 * tinha nenhum motivo próprio para carregar `autorizacao` até um colaborador
 * ganhar a possibilidade de não ter Agenda liberada. Vai no mesmo
 * `Promise.all` da leitura da agenda.
 *
 * Sem `export const dynamic`, pelo mesmo motivo de Clientes e Procedimentos: a
 * leitura passa pelo cliente do Supabase, que lê os cookies da sessão, e isso já
 * torna a página dinâmica.
 */
export default async function PaginaAgenda() {
  const [{ aviso, ...dados }, autorizacao] = await Promise.all([
    carregarAgenda(),
    carregarAutorizacao(),
  ]);

  await exigirTela(TELAS_CONTROLAVEIS.AGENDA, autorizacao);

  return (
    <>
      <Cabecalho
        titulo="Agenda"
        descricao="Consultas marcadas. Qualquer lead do Funil pode receber um horário aqui — marcar é o que move ele para Agendamento."
      />
      <AvisoDeCorte aviso={aviso} />
      <PainelAgenda {...dados} />
    </>
  );
}
