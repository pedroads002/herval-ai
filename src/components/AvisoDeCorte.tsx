import { AlertTriangle } from "lucide-react";

/**
 * O aviso de que a lista está cortada no teto de linhas.
 *
 * Não é o cartão vermelho de falha: os dados que estão na tela estão certos, só
 * não são todos. Vermelho aqui faria quem usa desconfiar do que está vendo, e o
 * que está sendo visto é verdade.
 *
 * Não leva "use client" de propósito: é texto, sem estado nem evento, e as
 * páginas que o usam são componentes de servidor.
 */
export default function AvisoDeCorte({ aviso }: { aviso: string | null }) {
  if (aviso === null) return null;

  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-card border border-black/15 bg-black/[0.03] px-5 py-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-black/45" />
      <p className="text-sm font-medium text-black/65">{aviso}</p>
    </div>
  );
}
