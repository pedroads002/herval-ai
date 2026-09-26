import MenuLateral from "@/components/MenuLateral";
import CabecalhoTopo from "@/components/CabecalhoTopo";
import ProvedorLeads from "@/components/ProvedorLeads";
import { carregarPerfil } from "@/lib/perfil";

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
 */
export default async function LayoutPainel({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const perfil = await carregarPerfil();

  return (
    <>
      <CabecalhoTopo />
      <MenuLateral />
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
        <ProvedorLeads usuario={perfil?.nomeCompleto}>{children}</ProvedorLeads>
      </main>
    </>
  );
}
