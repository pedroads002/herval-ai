import MenuLateral from "@/components/MenuLateral";
import CabecalhoTopo from "@/components/CabecalhoTopo";

/**
 * Moldura das telas internas: cabeçalho fixo e menu lateral. A tela de login
 * fica fora deste grupo, por isso não herda esse layout.
 */
export default function LayoutPainel({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <CabecalhoTopo />
      <MenuLateral />
      <main className="ml-56 px-6 pb-16 pt-24 md:ml-64 md:px-10">
        {children}
      </main>
    </>
  );
}
