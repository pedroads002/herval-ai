/**
 * A assinatura de quem fez o sistema.
 *
 * Fica separado do rodapé do menu lateral de propósito: aquele diz qual é o
 * produto ("Helô - Herval AI"), e este diz quem o desenvolveu. São duas
 * informações diferentes, e juntá-las na mesma linha faria o nome do produto
 * parecer parte da assinatura.
 */
export default function Rodape({ className = "" }: { className?: string }) {
  return (
    <footer
      className={[
        "text-center text-xs font-medium text-black/40",
        className,
      ].join(" ")}
    >
      Desenvolvido por Herval Marketing
    </footer>
  );
}
