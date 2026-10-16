import Cabecalho from "@/components/Cabecalho";
import ListaTemplates from "@/components/ListaTemplates";
import { exigirHervalAdmin } from "@/lib/autorizacao";

export default async function PaginaTemplates() {
  // Tela exclusiva da Herval. Ver `exigirHervalAdmin`.
  await exigirHervalAdmin();

  return (
    <>
      <Cabecalho
        titulo="Templates de WhatsApp"
        descricao="Textos que a automação envia, organizados pelo fluxo que os dispara."
      />
      <ListaTemplates />
    </>
  );
}
