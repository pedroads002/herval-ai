import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import PainelVisaoGeral from "@/components/PainelVisaoGeral";
import FiltrosDaVisaoGeral from "@/components/visaoGeral/FiltrosDaVisaoGeral";
import { carregarVisaoGeral } from "@/lib/dados/visaoGeral";
import { resolverPeriodo } from "@/lib/visaoGeral/periodo";

/**
 * A Visão Geral.
 *
 * Passou a ler o banco. Antes esta tela consumia memória do navegador semeada
 * por arquivos vazios — mostrava zero em tudo para todo mundo, em produção.
 *
 * O período e a clínica vêm do endereço, e não de estado da tela, porque é o
 * servidor que consulta o banco: sem isso o filtro voltaria a filtrar memória.
 *
 * Sem `export const dynamic`, pelo mesmo motivo do Funil e da Agenda: ler os
 * parâmetros da URL e os cookies da sessão já torna a página dinâmica.
 */
export default async function PaginaVisaoGeral({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const parametros = await searchParams;

  const periodo = resolverPeriodo(
    parametros.periodo,
    parametros.de,
    parametros.ate,
  );

  const clinicaEscolhida = Number(parametros.clinica);
  const clinicaId =
    Number.isInteger(clinicaEscolhida) && clinicaEscolhida > 0
      ? clinicaEscolhida
      : null;

  const dados = await carregarVisaoGeral(periodo, clinicaId);

  return (
    <>
      <Cabecalho
        titulo="Visão Geral"
        descricao="Resultado da operação comercial no período e no cliente selecionados, direto do banco."
      />
      <AvisoDeCorte aviso={dados.aviso} />

      <div className="space-y-10">
        <FiltrosDaVisaoGeral
          periodo={periodo}
          clinicas={dados.clinicas}
          clinicaId={clinicaId}
        />
        <PainelVisaoGeral dados={dados} periodo={periodo} />
      </div>
    </>
  );
}
