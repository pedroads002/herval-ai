import Cabecalho from "@/components/Cabecalho";
import GerenciadorFollowUp from "@/components/GerenciadorFollowUp";
import { exigirHervalAdmin } from "@/lib/autorizacao";
import { carregarFollowUp } from "@/lib/dados/followUp";

export default async function PaginaReguaAutomacao() {
  // Tela exclusiva da Herval. Ver `exigirHervalAdmin`.
  await exigirHervalAdmin();

  const { porEtapa, falha } = await carregarFollowUp();

  return (
    <>
      <Cabecalho
        titulo="Régua de Automação"
        descricao="Textos e tempo de espera de cada mensagem de follow-up enviada pela IA."
      />
      <GerenciadorFollowUp porEtapaInicial={porEtapa} falha={falha} />
    </>
  );
}
