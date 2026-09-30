import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import PainelFunil from "@/components/PainelFunil";
import { carregarFunil } from "@/lib/dados/funil";

/**
 * O Funil.
 *
 * Passou a ler o banco: os leads moram em `leads`, e mover um card grava a etapa
 * de verdade. Antes desta tela o quadro lia um arquivo vazio no código — dezesseis
 * colunas em branco — e o movimento morava na memória do navegador.
 *
 * A altura cheia é de propósito, e é o que permite ao quadro dar teto às colunas:
 * sem um pai de altura conhecida, `max-h-full` lá dentro não tem do que ser metade.
 *
 * Sem `export const dynamic`, pelo mesmo motivo da Agenda: a leitura passa pelo
 * cliente do Supabase, que lê os cookies da sessão, e isso já torna a página
 * dinâmica.
 */
export default async function PaginaFunil() {
  const { leads, falha, aviso } = await carregarFunil();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <Cabecalho
          titulo="Funil"
          descricao="Todos os leads da base distribuídos pelas etapas do pipeline. Mover um card grava a etapa e entra no histórico do lead."
        />
        <AvisoDeCorte aviso={aviso} />
      </div>
      <PainelFunil leads={leads} falha={falha} />
    </div>
  );
}
