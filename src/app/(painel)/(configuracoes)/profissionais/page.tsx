import Cabecalho from "@/components/Cabecalho";
import TabelaProfissionais from "@/components/TabelaProfissionais";
import { carregarProfissionais } from "@/lib/dados/profissionais";

/**
 * A segunda tela do painel que lê o banco — a primeira foi o Atendimento.
 *
 * Aqui "cliente" é uma linha em `clinicas`, sempre uma por cliente, tenha ele
 * uma unidade ou dez. "Profissional" é a pessoa que atende em uma ou mais
 * unidades desse cliente.
 *
 * Não há `export const dynamic` de propósito, pelo mesmo motivo do Atendimento:
 * a leitura passa pelo cliente do Supabase, que lê os cookies da sessão, e isso
 * já torna a página dinâmica. A opção `dynamic` está em via de saída no Next.
 */
export default async function PaginaProfissionais() {
  const { profissionais, clientes, falha } = await carregarProfissionais();

  return (
    <>
      <Cabecalho
        titulo="Profissionais"
        descricao="Quem atende em cada cliente e quais especialidades cada um cobre."
      />
      <TabelaProfissionais
        profissionais={profissionais}
        clientes={clientes}
        falha={falha}
      />
    </>
  );
}
