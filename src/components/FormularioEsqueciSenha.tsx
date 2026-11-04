"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { criarClienteNavegador } from "@/lib/supabase/navegador";

export default function FormularioEsqueciSenha() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function pedir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

    setEnviando(false);

    /**
     * Só erro de infraestrutura aparece. Conta inexistente não dá erro aqui —
     * e é de propósito, tanto do lado do Supabase quanto do nosso: responder
     * "esse e-mail não existe" entregaria a qualquer um, sem senha nenhuma, a
     * lista de quem tem acesso ao sistema.
     *
     * O limite de tentativas é o único que vale a pena explicar, porque é o
     * que a pessoa vê quando clica duas vezes achando que não funcionou.
     */
    if (error) {
      setErro(
        error.code === "over_email_send_rate_limit" ||
          error.code === "over_request_rate_limit"
          ? "Muitos pedidos seguidos. Espere alguns minutos e tente de novo."
          : "Não foi possível enviar agora. Tente de novo em instantes.",
      );
      return;
    }

    setEnviado(true);
  }

  const campo =
    "w-full rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/30";

  if (enviado) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-sm font-bold text-herval-preto">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-herval-verdeEscuro" />
          Pedido recebido
        </p>
        <p className="text-sm leading-relaxed text-black/65">
          Se existe uma conta com esse e-mail, o link para criar uma senha nova
          já está a caminho. Ele vale por uma hora e só pode ser usado uma vez.
        </p>
        <p className="text-sm leading-relaxed text-black/65">
          Não chegou em alguns minutos? Confira a caixa de spam antes de pedir
          de novo.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-herval-preto underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a tela de entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={pedir} className="space-y-4" noValidate>
      <p className="text-sm leading-relaxed text-black/65">
        Digite o e-mail com que você entra no painel. Vamos mandar um link para
        você criar uma senha nova.
      </p>

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-xs font-bold uppercase tracking-wide text-black/55"
        >
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@clinica.com.br"
          className={campo}
        />
      </div>

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-controle bg-herval-vermelho/10 px-3.5 py-3 text-sm font-medium text-herval-vermelho"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-controle bg-herval-verde px-4 py-3 text-sm font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
        {enviando ? "Enviando..." : "Enviar link"}
      </button>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm font-bold text-black/55 transition-colors hover:text-herval-preto"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
    </form>
  );
}
