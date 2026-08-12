import Cabecalho from "@/components/Cabecalho";
import ListaTemplates from "@/components/ListaTemplates";

export default function PaginaTemplates() {
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
