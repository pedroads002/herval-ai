"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Logo da Herval AI (public/logo.png). O arquivo já vem com fundo preto
 * próprio, então a imagem nunca é usada solta sobre fundo claro: ela mora
 * dentro de um selo preto arredondado, no formato de ícone de aplicativo.
 *
 * O tamanho e o arredondamento vêm de quem usa, pelo className; o padding
 * define a margem preta visível em volta do robô.
 */
export default function LogoHerval({ className = "" }: { className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const imagem = useRef<HTMLImageElement>(null);

  // A imagem pode falhar antes do React assumir a página. Nesse caso o evento
  // onError se perde, então conferimos o estado dela ao montar o componente.
  useEffect(() => {
    const el = imagem.current;
    if (el && el.complete && el.naturalWidth === 0) setFalhou(true);
  }, []);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-herval-preto ${className}`}
    >
      {falhou ? (
        // Sem o arquivo, um monograma "H" no lugar da imagem quebrada.
        <span
          aria-hidden
          className="text-base font-extrabold text-herval-verde"
        >
          H
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imagem}
          src="/logo.png"
          alt="Herval AI"
          onError={() => setFalhou(true)}
          className="h-full w-full object-contain"
        />
      )}
    </span>
  );
}
