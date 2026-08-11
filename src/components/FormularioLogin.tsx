"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { criarClienteNavegador } from "@/lib/supabase/navegador";

/** Traduz os erros mais comuns do Supabase para português simples. */
function mensagemDeErro(codigo: string | undefined, texto: string) {
  if (codigo === "invalid_credentials" || texto === "Invalid login credentials")
    return "E-mail ou senha incorretos. Confira e tente de novo.";
  if (codigo === "email_not_confirmed")
    return "Este e-mail ainda não foi confirmado no Supabase.";
  if (codigo === "over_request_rate_limit")
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  return "Não foi possível entrar. Tente novamente em instantes.";
}

export default function FormularioLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      setErro(mensagemDeErro(error.code, error.message));
      setEnviando(false);
      return;
    }

    // Recarrega do servidor para o proxy enxergar a sessão recém-criada.
    router.replace("/");
    router.refresh();
  }

  const campo =
    "w-full rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/30";

  return (
    <form onSubmit={entrar} className="space-y-4" noValidate>
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

      <div className="space-y-1.5">
        <label
          htmlFor="senha"
          className="block text-xs font-bold uppercase tracking-wide text-black/55"
        >
          Senha
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="••••••••"
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
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
