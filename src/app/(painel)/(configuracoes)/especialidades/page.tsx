import Cabecalho from "@/components/Cabecalho";
import ListaEspecialidades from "@/components/ListaEspecialidades";
import { carregarProcedimentos } from "@/lib/dados/procedimentos";

/**
 * O catálogo de procedimentos da agência.
 *
 * É a lista de onde cada profissional marca o que realiza. O que uma clínica
 * atende não se cadastra aqui: sai da equipe dela, procedimento por
 * procedimento, no cadastro de cada pessoa.
 *
 * Sem `export const dynamic`, pelo mesmo motivo de Clientes e Atendimento: a
 * leitura passa pelo cliente do Supabase, que lê os cookies da sessão, e isso já
 * torna a página dinâmica.
 */
export default async function PaginaEspecialidades() {
  const { procedimentos, falha } = await carregarProcedimentos();

  return (
    <>
      <Cabecalho
        titulo="Procedimentos"
        descricao="O catálogo da agência: nome, duração e quem realiza cada procedimento."
      />
      <ListaEspecialidades procedimentos={procedimentos} falha={falha} />
    </>
  );
}
