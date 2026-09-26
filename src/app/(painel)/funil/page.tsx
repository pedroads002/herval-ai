import Cabecalho from "@/components/Cabecalho";
import PainelFunil from "@/components/PainelFunil";

export default function PaginaFunil() {
  /*
    A tela ocupa a altura disponível para o quadro poder limitar a altura das
    colunas. Sem isso não há contra o que medir: as colunas esticariam juntas
    até a altura da mais cheia, que é o que fazia a coluna curta virar uma
    caixa vazia enorme.
  */
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <Cabecalho
          titulo="Funil"
          descricao="Todos os leads da base distribuídos pelas etapas do pipeline."
        />
      </div>
      <PainelFunil />
    </div>
  );
}
