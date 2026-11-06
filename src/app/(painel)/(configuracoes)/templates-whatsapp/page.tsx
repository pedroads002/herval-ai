import { redirect } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import GerenciadorTemplates from "@/components/templates/GerenciadorTemplates";
import VisaoDeTemplates from "@/components/templates/VisaoDeTemplates";
import SeletorDeCliente from "@/components/templates/SeletorDeCliente";
import { carregarTemplates } from "@/lib/dados/templates";
import {
  carregarAutorizacao,
  ehCliente,
  ehHervalAdmin,
  operacaoDoUsuario,
} from "@/lib/autorizacao";

/**
 * Os templates de WhatsApp.
 *
 * Passou a ler e gravar no banco. Antes esta tela mostrava um arquivo de
 * exemplo vazio e dizia a todo mundo que nenhum template existia, enquanto o
 * cérebro da Helô já lia `templates` e `template_mensagens` em produção e já
 * mandava essas mensagens — a agência não tinha por onde mudar o texto.
 *
 * **Duas telas no mesmo endereço, decididas pelo papel de quem abriu.** A
 * Herval vê o `GerenciadorTemplates`, que grava; quem é cliente
 * (`cliente_admin` ou `cliente_operacional`) vê o `VisaoDeTemplates`, que só
 * mostra — nenhum botão de criar, editar, ativar, excluir ou reordenar existe
 * naquele arquivo. Escrever o que a Helô manda em nome do cliente continua
 * sendo trabalho da agência; o cliente abre esta tela para conferir o texto
 * que sai no nome dele.
 *
 * Deixar as duas no mesmo endereço, e não numa rota nova, é de propósito: uma
 * cópia da rota seria um segundo lugar para esquecer de trancar, e o endereço
 * `/templates-whatsapp` já é o que o menu dos dois lados aponta.
 *
 * **Quem é cliente não escolhe o cliente — é o próprio.** A clínica vem de
 * `operacaoDoUsuario(autorizacao)` e o `?clinica=` da URL é ignorado, pelo
 * mesmo motivo da Visão Geral: o seletor foi desenhado para a Herval alternar
 * entre as clínicas que atende, e para um cliente ele só confundiria. Não é a
 * tranca de segurança — as políticas de `templates` e `template_mensagens` dão
 * ao papel de cliente apenas o SELECT da própria `clinica_id`, então URL
 * adulterada não mostraria o texto de outra clínica — é a tela não oferecer
 * uma escolha que não existe para essa conta.
 *
 * Toda a leitura é feita com a sessão do próprio usuário
 * (`criarClienteServidor`, dentro de `carregarTemplates`), nunca com a
 * `service_role`: é o RLS que separa uma clínica da outra, e passar por cima
 * dele aqui esvaziaria essa separação.
 *
 * Sem `export const dynamic`, pelo mesmo motivo das outras: ler os parâmetros
 * da URL e os cookies da sessão já torna a página dinâmica.
 */
export default async function PaginaTemplates({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const autorizacao = await carregarAutorizacao();

  if (!autorizacao) redirect("/login");

  const daHerval = ehHervalAdmin(autorizacao);
  const clienteLogado = ehCliente(autorizacao);

  // Nem Herval, nem cliente: conta sem autorização ativa. Mesmo destino de
  // `exigirHervalAdmin` — a Visão Geral, que é o que a conta sabe abrir.
  if (!daHerval && !clienteLogado) redirect("/visao-geral");

  const parametros = await searchParams;
  const escolhido = Number(parametros.clinica);

  const clinicaDaSessao = clienteLogado ? operacaoDoUsuario(autorizacao) : null;

  const dados = await carregarTemplates(
    clienteLogado
      ? clinicaDaSessao
      : Number.isInteger(escolhido) && escolhido > 0
        ? escolhido
        : null,
  );

  if (clienteLogado) {
    return (
      <>
        <Cabecalho
          titulo="Templates de WhatsApp"
          descricao="As mensagens que a Helô envia em cada momento do fluxo, em nome da sua clínica. Quem escreve e altera é a Herval."
        />
        <AvisoDeCorte aviso={dados.aviso} />

        <VisaoDeTemplates
          clinicaId={clinicaDaSessao}
          categorias={dados.categorias}
          templates={dados.templates}
          falha={dados.falha}
        />
      </>
    );
  }

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
