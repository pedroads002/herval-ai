import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import GerenciadorTemplates from "@/components/templates/GerenciadorTemplates";
import SeletorDeCliente from "@/components/templates/SeletorDeCliente";
import { carregarTemplates } from "@/lib/dados/templates";
import { exigirHervalAdmin } from "@/lib/autorizacao";

/**
 * Os templates de WhatsApp.
 *
 * Passou a ler e gravar no banco. Antes esta tela mostrava um arquivo de
 * exemplo vazio e dizia a todo mundo que nenhum template existia, enquanto o
 * cérebro da Helô já lia `templates` e `template_mensagens` em produção e já
 * mandava essas mensagens — a agência não tinha por onde mudar o texto.
 *
 * O cliente vem do endereço (`?clinica=38`), e não de estado da tela, porque é
 * o servidor que consulta o banco — mesmo motivo da Visão Geral.
 *
 * Sem `export const dynamic`, pelo mesmo motivo das outras: ler os parâmetros
 * da URL e os cookies da sessão já torna a página dinâmica.
 */
export default async function PaginaTemplates({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  // Tela exclusiva da Herval: é a agência que escreve o que a Helô manda em
  // nome do cliente. Ver `exigirHervalAdmin`.
  await exigirHervalAdmin();

  const parametros = await searchParams;
  const escolhido = Number(parametros.clinica);
  const dados = await carregarTemplates(
    Number.isInteger(escolhido) && escolhido > 0 ? escolhido : null,
  );

  // Id que não é de nenhum cliente da lista vale como "nenhum escolhido": a
  // tela pede para escolher, em vez de mostrar uma categoria vazia e deixar
  // parecer que o cliente não tem template nenhum.
  const clinicaId = dados.clinicas.some((c) => c.id === escolhido)
    ? escolhido
    : null;

  return (
    <>
      <Cabecalho
        titulo="Templates de WhatsApp"
        descricao="As mensagens que a Helô envia em cada momento do fluxo, cliente por cliente."
      />
      <AvisoDeCorte aviso={dados.aviso} />

      <div className="space-y-8">
        <SeletorDeCliente clinicas={dados.clinicas} clinicaId={clinicaId} />
        <GerenciadorTemplates
          clinicaId={clinicaId}
          categorias={dados.categorias}
          templates={dados.templates}
          falha={dados.falha}
        />
      </div>
    </>
  );
}
