import PainelAtendimento from "@/components/PainelAtendimento";

/**
 * O atendimento de um lead. A rota entra pelo card do Funil, e não por uma
 * lista própria: duplicar a fila era o que a especificação pediu para evitar.
 */
export default async function PaginaAtendimento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PainelAtendimento leadId={Number(id)} />;
}
