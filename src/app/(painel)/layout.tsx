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
 */
export default async function LayoutPainel({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const perfil = await carregarPerfil();

  return (
    <>
      <CabecalhoTopo />
      <MenuLateral />
      <main className="ml-56 px-6 pb-16 pt-24 md:ml-64 md:px-10">
        <ProvedorLeads usuario={perfil?.nomeCompleto}>{children}</ProvedorLeads>
      </main>
    </>
  );
}
