const estilos: Record<string, string> = {
  neutro: "bg-slate-100 text-slate-700",
  sucesso: "bg-emerald-100 text-emerald-700",
  atencao: "bg-amber-100 text-amber-700",
  erro: "bg-rose-100 text-rose-700",
  info: "bg-blue-100 text-blue-700",
};

export default function Etiqueta({
  texto,
  tom = "neutro",
}: {
  texto: string;
  tom?: keyof typeof estilos;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${estilos[tom]}`}
    >
      {texto}
    </span>
  );
}
