import PainelAtendimento from "@/components/PainelAtendimento";

/**
 * O atendimento de um lead. Chega-se aqui pela lista de conversas em
 * `/atendimento` ou pelo card do Funil — a tela é a mesma nos dois caminhos.
 *
 * A lista não é a segunda fila que a especificação pediu para evitar: aquela
 * regra é sobre não repetir a medição da Fila de Atendimento, e aqui não se
 * mede nada, só se ordena quem responder primeiro.
 */
export default async function PaginaAtendimento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PainelAtendimento leadId={Number(id)} />;
}
