import Cabecalho from "@/components/Cabecalho";
import FormularioDePerfil from "@/components/FormularioDePerfil";
import { carregarPerfil } from "@/lib/perfil";

/**
 * O perfil de quem está logado.
 *
 * Fora do menu lateral de propósito: o menu é o produto — fila, funil,
 * clientes —, e isto é da conta de quem entrou. Chega-se por ela, no círculo
 * das iniciais no canto superior direito.
 *
 * Sem `export const dynamic` pelo mesmo motivo das outras telas: a leitura
 * passa pelo cliente do Supabase, que lê os cookies da sessão.
 */
export default async function PaginaPerfil() {
  const perfil = await carregarPerfil();

  return (
    <>
      <Cabecalho
        titulo="Perfil"
        descricao="O nome que assina o que esta conta grava no painel."
      />
      {perfil === null ? (
        <p className="rounded-card border border-black/15 bg-herval-branco p-5 text-sm font-medium text-black/60 shadow-card">
          Não foi possível ler a sua sessão. Entre de novo para ver o perfil.
        </p>
      ) : (
        <FormularioDePerfil
          nomeInicial={perfil.nome}
          sobrenomeInicial={perfil.sobrenome}
          email={perfil.email}
        />
      )}
    </>
  );
}
