"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { criarClienteNavegador } from "@/lib/supabase/navegador";

/** O mesmo piso que o Supabase exige por padrão. */
const MINIMO_DE_CARACTERES = 6;

export default function FormularioNovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    // Conferido aqui antes de ir ao servidor: são os dois erros que a pessoa
    // comete digitando, e para eles a resposta imediata vale mais que a ida
    // e volta.
    if (senha.length < MINIMO_DE_CARACTERES) {
      setErro(
        `A senha precisa ter pelo menos ${MINIMO_DE_CARACTERES} letras ou números.`,
      );
      return;
    }
    if (senha !== repetida) {
      setErro("As duas senhas não são iguais. Confira e digite de novo.");
      return;
    }

    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setErro(
        error.code === "same_password"
          ? "Essa já é a sua senha atual. Escolha uma diferente."
          : "Não foi possível salvar a senha. Peça um link novo e tente de novo.",
      );
      setSalvando(false);
      return;
    }

    /**
     * Encerra a sessão antes de mandar para o login, em vez de entrar direto.
     *
     * É a mesma decisão já tomada em `app/confirmar-email/page.tsx`: quem
     * clicou no link pode estar num navegador que já tinha a sessão de outra
     * conta, e entrar por link de e-mail deixaria essa sessão antiga valendo.
     * Fazendo a pessoa entrar com a senha que acabou de criar, ela também
     * prova na hora que a senha funciona — em vez de descobrir amanhã que
     * digitou errado nas duas caixas.
     */
    await supabase.auth.signOut();
    router.replace("/login?senhaAlterada=1");
    router.refresh();
  }

  const campo =
    "w-full rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/30";

  return (
    <form onSubmit={salvar} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label
          htmlFor="senha"
          className="block text-xs font-bold uppercase tracking-wide text-black/55"
        >
          Senha nova
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="new-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="••••••••"
          className={campo}
        />
        <p className="text-xs font-medium text-black/45">
          Pelo menos {MINIMO_DE_CARACTERES} caracteres.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="repetida"
          className="block text-xs font-bold uppercase tracking-wide text-black/55"
        >
          Repita a senha nova
        </label>
        <input
          id="repetida"
          type="password"
          autoComplete="new-password"
          required
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
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
        disabled={salvando}
        className="flex w-full items-center justify-center gap-2 rounded-controle bg-herval-verde px-4 py-3 text-sm font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:opacity-60"
      >
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
        {salvando ? "Salvando..." : "Salvar senha nova"}
      </button>
    </form>
  );
}
