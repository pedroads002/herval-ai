import AtualizacaoAutomatica from "@/components/AtualizacaoAutomatica";
import ConversaReal from "@/components/ConversaReal";
import { carregarConversa } from "@/lib/dados/atendimento";

/**
 * O atendimento de um lead, lido do banco.
 *
 * Esta rota também é o destino do botão "Atender" do Funil, que ainda usa
 * dados de exemplo. Um card de lá cai num id que não existe no banco, e a tela
 * diz isso em vez de dar erro — é a costura visível entre a parte que já é
 * real e a que ainda não é, e escondê-la seria pior que mostrá-la.
 */
export default async function PaginaDoAtendimento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { lead, mensagens, notas, clinica, especialidades, falha } =
    await carregarConversa(Number(id));

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
      />
    </>
  );
}
