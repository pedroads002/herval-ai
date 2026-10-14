"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function FormularioCadastro() {
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [codigoAcesso, setCodigoAcesso] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (senha !== confirmarSenha) {
      setErro("As senhas não conferem.");
      return;
    }

    setEnviando(true);

    const resposta = await fetch("/api/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomeCompleto, email, cpfCnpj, codigoAcesso, senha, confirmarSenha }),
    }).catch(() => null);

    const corpo = await resposta?.json().catch(() => null);

    if (!resposta || !corpo?.ok) {
      setErro(corpo?.motivo ?? "Não foi possível concluir o cadastro. Tente novamente.");
      setEnviando(false);
      return;
    }

    setSucesso(true);
    setEnviando(false);
  }

  if (sucesso) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-controle bg-herval-verde/10 px-3.5 py-3 text-sm font-medium text-herval-preto"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-herval-verde" />
        Conta criada. Abra seu e-mail, clique no link de confirmação e depois
        entre normalmente.
      </p>
    );
  }

  const campo =
    "w-full rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/30";

  const rotulo = "block text-xs font-bold uppercase tracking-wide text-black/55";

  return (
    <form onSubmit={cadastrar} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="nomeCompleto" className={rotulo}>
          Nome completo
        </label>
        <input
          id="nomeCompleto"
          type="text"
          autoComplete="name"
          required
          value={nomeCompleto}
          onChange={(e) => setNomeCompleto(e.target.value)}
          placeholder="Seu nome completo"
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className={rotulo}>
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
        <label htmlFor="cpfCnpj" className={rotulo}>
          CPF ou CNPJ
        </label>
        <input
          id="cpfCnpj"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          placeholder="Só números ou com pontuação"
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="codigoAcesso" className={rotulo}>
          Código de acesso
        </label>
        <input
          id="codigoAcesso"
          type="text"
          autoComplete="off"
          required
          value={codigoAcesso}
          onChange={(e) => setCodigoAcesso(e.target.value)}
          placeholder="O código que a Herval te passou"
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="senha" className={rotulo}>
          Senha
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Mínimo de 8 caracteres"
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmarSenha" className={rotulo}>
          Confirmar senha
        </label>
        <input
          id="confirmarSenha"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          placeholder="Repita a senha"
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
        {enviando ? "Criando conta..." : "Criar conta"}
      </button>
    </form>
  );
}
