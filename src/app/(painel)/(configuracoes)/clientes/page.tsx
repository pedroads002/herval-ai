import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import CadastroCliente from "@/components/CadastroCliente";
import TabelaClientes from "@/components/TabelaClientes";
import { carregarProfissionais } from "@/lib/dados/profissionais";

/**
 * A tela dos clientes atendidos pela Helô.
 *
 * "Cliente" é uma linha em `clinicas`, e é a entidade-pai do cadastro: pode ser
 * um profissional que atende sozinho ou uma clínica com equipe. Os
 * profissionais pertencem ao cliente, e os procedimentos pertencem a cada
 * profissional.
 *
 * Não há `export const dynamic` de propósito, pelo mesmo motivo do Atendimento:
 * a leitura passa pelo cliente do Supabase, que lê os cookies da sessão, e isso
 * já torna a página dinâmica. A opção `dynamic` está em via de saída no Next.
 */
export default async function PaginaClientes() {
  const { clientes, especialidades, falha, aviso } =
    await carregarProfissionais();

  return (
    <>
      <Cabecalho
        titulo="Clientes"
        descricao="Gerencie as operações atendidas pela Helô."
      />
      {/* O cadastro não aparece quando a leitura falhou: sem saber quais
          clientes e procedimentos existem, o formulário ofereceria listas
          vazias e o cadastro cairia no banco pela metade. */}
      {!falha && (
        <div className="mb-8">
          <CadastroCliente
            clientes={clientes}
            especialidades={especialidades}
          />
        </div>
      )}

      <AvisoDeCorte aviso={aviso} />
      <TabelaClientes clientes={clientes} falha={falha} />
    </>
  );
}
