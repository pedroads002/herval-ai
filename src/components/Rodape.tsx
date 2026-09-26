/**
 * A assinatura de quem fez o sistema, na tela de login.
 *
 * Dentro do painel ela não mora mais aqui: virou uma segunda linha no rodapé
 * do menu lateral, embaixo do nome do produto. Solta no fim da página, ficava
 * flutuando sozinha e obrigava a página a rolar só por causa dela.
 *
 * O login não tem menu lateral, então continua usando este componente — é a
 * única tela onde a assinatura ainda precisa de lugar próprio.
 */
export default function Rodape({ className = "" }: { className?: string }) {
  return (
    <footer
      className={[
        "text-center text-xs font-medium text-black/40",
        className,
      ].join(" ")}
    >
      Desenvolvido por Herval Marketing®
    </footer>
  );
}
