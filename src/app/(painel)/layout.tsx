import { redirect } from "next/navigation";
import MenuLateral from "@/components/MenuLateral";
import MenuLateralCliente from "@/components/MenuLateralCliente";
import CabecalhoTopo from "@/components/CabecalhoTopo";
import ProvedorLeads from "@/components/ProvedorLeads";
import { carregarPerfil } from "@/lib/perfil";
import { carregarFilaDeTarefas } from "@/lib/dados/tarefas";
import { carregarAutorizacao, ehCliente, PAPEIS } from "@/lib/autorizacao";

/**
 * Moldura das telas internas: cabeçalho fixo e menu lateral. A tela de login
 * fica fora deste grupo, por isso não herda esse layout.
 *
 * O perfil é lido aqui e desce para o provedor porque toda ação manual passa a
 * ser assinada por quem está logado — não há cadastro de agente separado.
 *
 * **Quem rola é esta área, não a página.** O cabeçalho e o menu já eram fixos,
 * mas a janela inteira ainda rolava por baixo deles: numa tela de atendimento
 * a moldura ficava parada e o conteúdo deslizava, o que dá a impressão de duas
 * páginas sobrepostas. Agora a área de conteúdo tem exatamente a altura que
 * sobra da tela e a rolagem acontece dentro dela.
 *
 * Telas compridas (Funil, Relatórios) rolam igual ao que rolavam — mudou o
 * elemento que rola, não a sensação. Telas que cabem inteiras, como o
 * Atendimento, deixam de rolar.
 *
 * **O menu lateral depende de quem está logado.** A Herval continua vendo o
 * `MenuLateral` de sempre, inteiro. Quem é cliente (`cliente_admin` ou
 * `cliente_operacional`) vê o `MenuLateralCliente`, cortado para as cinco
 * telas que o autocadastro prometeu — `cliente_admin` ganha uma sexta,
 * Equipe, de onde convida colaborador para a própria clínica e decide, por
 * colaborador, quais das quatro telas opcionais (fora Visão Geral) ele vê.
 * Um `cliente_operacional` só vê, das quatro, as que o próprio `cliente_admin`
 * liberou para ele (`autorizacao.telasPermitidas`) — o resto do painel
 * continua existindo, só não tem link para lá; a tranca de verdade é
 * `exigirHervalAdmin` (telas da Herval), `exigirClienteAdmin` (Equipe) e
 * `exigirTela` (as quatro telas opcionais), dentro de cada página, porque
 * esconder o link não impede digitar o endereço.
 *
 * Sem sessão nenhuma, a pessoa nem chega a ver o painel: cai no login. Com
 * sessão mas sem autorização ativa (conta órfã — por exemplo, alguém
 * desativado depois de já ter entrado uma vez) também não vê o painel, só o
 * aviso: nem o menu da Herval nem o do cliente dizem a verdade para essa
 * conta.
 */
export default async function LayoutPainel({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // A fila é lida aqui, e não na página da Fila de Tarefas, porque quem guarda
  // as tarefas é o provedor, que mora neste layout. As leituras não dependem
  // uma da outra, e podem ir juntas no mesmo `Promise.all`.
  const [perfil, fila, autorizacao] = await Promise.all([
    carregarPerfil(),
    carregarFilaDeTarefas(),
    carregarAutorizacao(),
  ]);

  // Sem sessão, não há painel para mostrar.
  if (!autorizacao) redirect("/login");

  // Logado, mas sem autorização ativa: nem Herval, nem cliente. Mostra o
  // cabeçalho (é dali que a pessoa consegue sair) e explica, em vez de cair
  // num painel que não é dela.
  if (!autorizacao.autorizado) {
    return (
      <>
        <CabecalhoTopo />
        <main className="mt-16 flex min-h-[calc(100dvh-4rem)] items-center justify-center p-6">
          <div className="max-w-sm rounded-card border border-black/10 bg-herval-branco p-8 text-center shadow-card">
            <h1 className="text-lg font-extrabold tracking-tight text-herval-preto">
              Sem acesso
            </h1>
            <p className="mt-2 text-sm font-medium text-black/55">
              Sua conta está logada, mas não tem nenhum acesso liberado neste
              momento. Peça à Herval um novo convite, ou avise se isso for um
              engano.
            </p>
          </div>
        </main>
      </>
    );
  }

  const cliente = ehCliente(autorizacao);

  return (
    <>
      <CabecalhoTopo />
      {cliente ? (
        <MenuLateralCliente
          mostrarEquipe={autorizacao.papel === PAPEIS.CLIENTE_ADMIN}
          // Só o colaborador é restringido por tela (ver `telaPermitidaParaColaborador`
          // em `src/lib/autorizacao.ts`) — `cliente_admin` sempre recebe `null`
          // (sem restrição), mesmo que a própria linha dele tenha algum valor
          // gravado por engano.
          telasPermitidas={
            autorizacao.papel === PAPEIS.CLIENTE_OPERACIONAL
              ? autorizacao.telasPermitidas
              : null
          }
        />
      ) : (
        <MenuLateral />
      )}
      {/*
        A margem em volta é pequena de propósito: com 24px nos lados e 32px em
        cima e embaixo, os cartões pareciam flutuar dentro de uma moldura de
        espaço morto em vez de ocupar a tela.

        Doze pixels, iguais dos quatro lados. Zero encostaria os cartões na
        borda da janela e cortaria a sombra deles; os cartões já têm respiro
        próprio por dentro (`p-5`), então a folga aqui só precisa separar da
        borda, não repetir esse respiro.
      */}
      <main className="ml-56 mt-16 h-[calc(100dvh-4rem)] overflow-y-auto p-3 md:ml-64">
        <ProvedorLeads
          usuario={perfil?.nomeCompleto}
          tarefasDoBanco={fila.tarefas}
          leadsParaTarefa={fila.leads}
          avisoDaFila={fila.falha ?? fila.aviso}
        >
          {children}
        </ProvedorLeads>
      </main>
    </>
  );
}
