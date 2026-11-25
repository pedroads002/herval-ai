import Cabecalho from "@/components/Cabecalho";
import PainelPacientes from "@/components/PainelPacientes";
import { carregarPacientes, lerFiltros } from "@/lib/dados/pacientes";
import { ehCliente, exigirTela, TELAS_CONTROLAVEIS } from "@/lib/autorizacao";

/**
 * Pacientes: a base de leads da clínica em lista, em ordem alfabética, 25 por
 * página, com edição, troca de etapa, importação, exportação, duplicados e
 * exclusão.
 *
 * É seção própria, com liberação própria em Equipe (`pacientes`), mas não
 * guarda nada à parte: paciente é o mesmo registro de `leads` que o Funil, o
 * Atendimento e a Agenda usam. Mudar aqui é mudar lá.
 *
 * `exigirTela` vem antes de qualquer leitura: colaborador sem Pacientes
 * liberado cai na Visão Geral sem a página tocar no banco.
 */
export default async function PaginaPacientes({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const autorizacao = await exigirTela(TELAS_CONTROLAVEIS.PACIENTES);
  const filtros = lerFiltros(await searchParams, autorizacao);
  const dados = await carregarPacientes(filtros, autorizacao);

  return (
    <>
      <Cabecalho
        titulo="Pacientes"
        descricao={
          ehCliente(autorizacao)
            ? "Todos os pacientes da clínica, em ordem alfabética. O que você muda aqui vale no Funil, no Atendimento e na Agenda."
            : "Os pacientes de cada cliente, em ordem alfabética. Escolha o cliente para ver só a base dele. O que você muda aqui vale no Funil, no Atendimento e na Agenda."
        }
      />
      <PainelPacientes {...dados} filtros={filtros} />
    </>
  );
}
