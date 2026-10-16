import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import PainelVisaoGeral from "@/components/PainelVisaoGeral";
import FiltrosDaVisaoGeral from "@/components/visaoGeral/FiltrosDaVisaoGeral";
import { carregarVisaoGeral } from "@/lib/dados/visaoGeral";
import { resolverPeriodo } from "@/lib/visaoGeral/periodo";
import {
  carregarAutorizacao,
  ehCliente,
  operacaoDoUsuario,
} from "@/lib/autorizacao";

/**
 * A Visão Geral.
 *
 * Passou a ler o banco. Antes esta tela consumia memória do navegador semeada
 * por arquivos vazios — mostrava zero em tudo para todo mundo, em produção.
 *
 * O período e a clínica vêm do endereço, e não de estado da tela, porque é o
 * servidor que consulta o banco: sem isso o filtro voltaria a filtrar memória.
 *
 * **Quem é cliente não escolhe a clínica — é a própria.** O seletor foi
 * desenhado para a Herval alternar entre as clínicas que atende; para um
 * cliente ele só confundiria ("por que eu escolheria outra clínica?"), então
 * a leitura força `operacaoDoUsuario(autorizacao)` e ignora `?clinica=` da
 * URL. Não é uma segunda tranca de segurança — a política de `leads` já
 * impede ver dado de outra clínica mesmo que a URL fosse adulterada — é só a
 * tela não oferecer uma escolha que não existe para essa conta.
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

  const autorizacao = await carregarAutorizacao();
  const clienteLogado = ehCliente(autorizacao);

  const clinicaEscolhida = Number(parametros.clinica);
  const clinicaId = clienteLogado
    ? operacaoDoUsuario(autorizacao)
    : Number.isInteger(clinicaEscolhida) && clinicaEscolhida > 0
      ? clinicaEscolhida
      : null;

  const dados = await carregarVisaoGeral(periodo, clinicaId);

  return (
    <>
      <Cabecalho
        titulo="Visão Geral"
        descricao={
          clienteLogado
            ? "Resultado da sua operação comercial no período selecionado, direto do banco."
            : "Resultado da operação comercial no período e no cliente selecionados, direto do banco."
        }
      />
      <AvisoDeCorte aviso={dados.aviso} />

      <div className="space-y-10">
        <FiltrosDaVisaoGeral
          periodo={periodo}
          clinicas={dados.clinicas}
          clinicaId={clinicaId}
          seletorDeClinica={!clienteLogado}
        />
        <PainelVisaoGeral dados={dados} periodo={periodo} />
      </div>
    </>
  );
}
