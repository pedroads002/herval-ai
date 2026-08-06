/**
 * Badge em formato de pílula, inspirado no ícone da logo.
 * Só usa a paleta da marca: verde, preto e branco.
 */
const estilos = {
  // Estado positivo: verde da marca.
  verde: "bg-herval-verde text-herval-preto",
  // Estado neutro/aguardando: contorno preto sobre branco.
  contorno: "border border-black/25 bg-herval-branco text-black/70",
  // Estado encerrado/negado: preto sólido.
  preto: "bg-herval-preto text-herval-branco",
} as const;

export type TomEtiqueta = keyof typeof estilos;

export default function Etiqueta({
  texto,
  tom = "contorno",
}: {
  texto: string;
  tom?: TomEtiqueta;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${estilos[tom]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tom === "verde"
            ? "bg-herval-preto"
            : tom === "preto"
              ? "bg-herval-branco"
              : "bg-black/40"
        }`}
      />
      {texto}
    </span>
  );
}
