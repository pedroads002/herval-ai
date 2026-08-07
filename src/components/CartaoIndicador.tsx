import { AlertTriangle } from "lucide-react";

export default function CartaoIndicador({
  rotulo,
  valor,
  detalhe,
  alerta = false,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-card border bg-herval-branco p-5 shadow-card",
        alerta ? "border-herval-preto" : "border-black/10",
      ].join(" ")}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-black/45">
        {rotulo}
      </p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-herval-preto">
        {valor}
      </p>

      {detalhe &&
        (alerta ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-herval-preto px-2.5 py-1 text-[11px] font-bold text-herval-branco">
            <AlertTriangle className="h-3 w-3" />
            {detalhe}
          </p>
        ) : (
          <p className="mt-2 text-xs font-medium text-black/50">{detalhe}</p>
        ))}
    </div>
  );
}
