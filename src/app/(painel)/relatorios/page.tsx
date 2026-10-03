import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import PainelRelatorios from "@/components/PainelRelatorios";
import { carregarRelatorios } from "@/lib/dados/relatorios";

/**
 * Os Relatórios.
 *
 * Passaram a ler o banco. Antes a tela consumia memória do navegador semeada
 * por arquivos vazios — tabela sem nenhuma linha para todo mundo, em produção.
 *
 * Sem `export const dynamic`, pelo mesmo motivo do Funil e da Visão Geral: ler
 * os cookies da sessão já torna a página dinâmica.
 */
export default async function PaginaRelatorios() {
  const dados = await carregarRelatorios();

  return (
    <>
      <Cabecalho
        titulo="Relatórios"
        descricao="Desempenho comercial de todas as clínicas atendidas, por período."
      />
      <AvisoDeCorte aviso={dados.aviso} />
      <PainelRelatorios dados={dados} />
    </>
  );
}
