export default function Cabecalho({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao: string;
}) {
  return (
    <header className="mb-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-herval-preto">
        {titulo}
      </h1>
      <p className="mt-2 text-sm font-medium text-black/55">{descricao}</p>
      <span className="mt-5 block h-1 w-12 rounded-full bg-herval-verde" />
    </header>
  );
}
