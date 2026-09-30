import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import DetalheCliente, { ResumoDoCliente } from "@/components/DetalheCliente";
import { carregarCliente } from "@/lib/dados/profissionais";

/**
 * A tela de um cliente.
 *
 * O id vem da rota como texto e pode ser qualquer coisa — `/clientes/abc` é um
 * endereço que alguém consegue digitar. Um id que não é número vira "cliente
 * não encontrado", que é a verdade, em vez de uma consulta com `NaN`.
 */
export default async function PaginaDoCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numero = Number(id);

  const { cliente, especialidades, falha } = Number.isInteger(numero)
    ? await carregarCliente(numero)
    : { cliente: null, especialidades: [], falha: null };

  if (falha) {
    return (
      <>
        <Voltar />
        <Cabecalho titulo="Cliente" descricao="Não deu para carregar." />
        <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
          <p className="text-sm font-medium text-black/60">{falha}</p>
        </div>
      </>
    );
  }

  if (!cliente) {
    return (
      <>
        <Voltar />
        <Cabecalho
          titulo="Cliente não encontrado"
          descricao="Ele pode ter sido excluído, ou o endereço está errado."
        />
      </>
    );
  }

  return (
    <>
      <Voltar />
      <Cabecalho
        titulo={cliente.nome}
        descricao={
          cliente.tipoOperacao === "individual"
            ? "Atende sozinho e utiliza seu próprio canal de atendimento."
            : "A operação possui mais de um profissional utilizando o mesmo canal de atendimento."
        }
      />
      <div className="-mt-6 mb-8">
        <ResumoDoCliente cliente={cliente} />
      </div>

      <DetalheCliente cliente={cliente} especialidades={especialidades} />
    </>
  );
}

function Voltar() {
  return (
    <Link
      href="/clientes"
      className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Todos os clientes
    </Link>
  );
}
