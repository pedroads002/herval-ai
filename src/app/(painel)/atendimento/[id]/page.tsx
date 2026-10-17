import AtualizacaoAutomatica from "@/components/AtualizacaoAutomatica";
import ConversaReal from "@/components/ConversaReal";
import { carregarConversa } from "@/lib/dados/atendimento";
import { carregarCliente } from "@/lib/dados/profissionais";
import { carregarConsultasDoLead } from "@/lib/dados/agenda";
import { carregarAutorizacao, exigirTela, TELAS_CONTROLAVEIS } from "@/lib/autorizacao";

/**
 * O atendimento de um lead, lido do banco.
 *
 * Esta rota também é o destino do botão "Atender" do Funil, que ainda usa
 * dados de exemplo. Um card de lá cai num id que não existe no banco, e a tela
 * diz isso em vez de dar erro — é a costura visível entre a parte que já é
 * real e a que ainda não é, e escondê-la seria pior que mostrá-la.
 *
 * `exigirTela` estava faltando aqui: a lista em `/atendimento` já travava
 * certo, mas esta tela (uma conversa específica) ficava sem a mesma
 * conferência — um colaborador sem Conversas liberado não via o link, mas
 * digitando o endereço direto (`/atendimento/42`) entrava do mesmo jeito.
 */
export default async function PaginaDoAtendimento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ lead, mensagens, notas, clinica, especialidades, falha }, autorizacao] =
    await Promise.all([carregarConversa(Number(id)), carregarAutorizacao()]);

  await exigirTela(TELAS_CONTROLAVEIS.ATENDIMENTO, autorizacao);

  /**
   * O cliente (unidades e equipe) só dá para buscar depois de saber de qual
   * clínica este lead é — por isso é uma segunda leitura, e não a mesma do
   * `Promise.all` de cima. Lead sem clínica, ou sem id válido, não tem onde
   * marcar consulta: a Agenda do Atendimento mostra isso em vez de agendar.
   */
  const [cliente, consultas] = await Promise.all([
    lead && lead.clinicaId !== null
      ? carregarCliente(lead.clinicaId)
      : Promise.resolve({ cliente: null, especialidades: [], falha: null, aviso: null }),
    lead ? carregarConsultasDoLead(lead.id) : Promise.resolve([]),
  ]);

  /**
   * Se o envio está ligado é decidido aqui, no servidor: as variáveis não têm
   * `NEXT_PUBLIC_`, de propósito, então o navegador não consegue lê-las. Sem
   * isso o botão prometeria um envio que só falharia depois do clique.
   *
   * Só o "sim ou não" atravessa — nunca a URL nem o token.
   */
  const envioConfigurado =
    Boolean(process.env.N8N_ENVIO_URL) && Boolean(process.env.N8N_ENVIO_TOKEN);

  return (
    <>
      <AtualizacaoAutomatica />
      <ConversaReal
        lead={lead}
        mensagens={mensagens}
        notas={notas}
        clinica={clinica}
        especialidades={especialidades}
        falha={falha}
        envioConfigurado={envioConfigurado}
        unidades={cliente.cliente?.unidades ?? []}
        equipe={cliente.cliente?.profissionais ?? []}
        consultas={consultas}
      />
    </>
  );
}
