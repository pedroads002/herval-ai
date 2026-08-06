"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mostra a logo da Herval a partir de public/logo-light.png e
 * public/logo-dark.png. Enquanto esses arquivos não existirem, cai em um
 * monograma "H" para a tela não ficar com imagem quebrada.
 */
export default function LogoHerval({
  variante,
  className = "",
}: {
  variante: "light" | "dark";
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const imagem = useRef<HTMLImageElement>(null);

  // A imagem pode falhar antes do React assumir a página. Nesse caso o evento
  // onError se perde, então conferimos o estado dela ao montar o componente.
  useEffect(() => {
    const el = imagem.current;
    if (el && el.complete && el.naturalWidth === 0) setFalhou(true);
  }, []);

  if (falhou) {
    const cores =
      variante === "dark"
        ? "bg-herval-verde text-herval-preto"
        : "bg-herval-preto text-herval-verde";

    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-controle text-base font-extrabold ${cores} ${className}`}
      >
        H
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imagem}
      src={`/logo-${variante}.png`}
      alt="Herval AI"
      onError={() => setFalhou(true)}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
