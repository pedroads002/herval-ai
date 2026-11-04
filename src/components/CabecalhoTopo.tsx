import LogoHerval from "@/components/LogoHerval";
import MenuUsuario from "@/components/MenuUsuario";
import { carregarPerfil } from "@/lib/perfil";

export default async function CabecalhoTopo({
  comMenu = false,
}: Readonly<{ comMenu?: boolean }>) {
  const perfil = await carregarPerfil();

  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-black/10 bg-herval-branco shadow-topo">
      <div
        className={[
          "flex h-full items-center gap-3 pr-4 sm:pr-6",
          // No celular o botão de menu ocupa os 56px da esquerda desta mesma
          // faixa (ver `MenuGaveta`); sem reservar o espaço, a logo ficaria por
          // baixo dele. Na tela de "Sem acesso" não há menu nenhum, e aí a
          // logo volta para a borda.
          comMenu ? "pl-14 md:pl-6" : "pl-4 sm:pl-6",
        ].join(" ")}
      >
        <LogoHerval className="h-10 w-10 rounded-controle p-1" />

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight text-herval-preto">
            Herval AI
          </span>
          <span className="hidden text-xs font-medium text-black/50 sm:inline">
            Painel operacional
          </span>
        </div>

        {perfil && (
          <MenuUsuario
            iniciais={perfil.iniciais}
            nomeCompleto={perfil.nomeCompleto}
            email={perfil.email}
          />
        )}
      </div>
    </header>
  );
}
