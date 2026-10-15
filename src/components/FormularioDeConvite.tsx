"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Campo, botaoPrincipal, useValores } from "@/components/cadastro/comuns";
import { validarCpfCnpj } from "@/lib/documento";

/**
 * O formulário do autocadastro — a tela que o cliente vê ao abrir o convite.
 *
 * Não é uma Server Action, de propósito: quem preenche isto ainda não tem
 * conta nenhuma, então não existe sessão para a ação verificar, e a rota
 * (`/api/convite/completar`) é quem faz essa conferência pelo lado de dentro.
 * As mesmas perguntas do fetch vêm por aqui: `enviando` trava o botão, e o
 * aviso de erro ou sucesso é o mesmo texto que a rota devolveu.
 */
export default function FormularioDeConvite({ token }: { token: string }) {
  const { valores, mudar } = useValores({});
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");

    const senha = valores.senha ?? "";
    const confirmarSenha = valores.confirmar_senha ?? "";
    const cpfCnpj = valores.cpf_cnpj ?? "";

    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas digitadas são diferentes.");
      return;
    }
    if (!validarCpfCnpj(cpfCnpj)) {
      setErro("CPF ou CNPJ inválido. Confira os números digitados.");
      return;
    }

    setEnviando(true);

    const resposta = await fetch("/api/convite/completar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        nomeCompleto: valores.nome_completo ?? "",
        email: valores.email ?? "",
        cpfCnpj,
        codigoAcesso: valores.codigo_acesso ?? "",
        senha,
      }),
    }).catch(() => null);

    const corpo = await resposta?.json().catch(() => null);

    if (!resposta || !corpo?.ok) {
      setErro(corpo?.motivo || "Não deu para concluir o cadastro. Tente de novo em instantes.");
      setEnviando(false);
      return;
    }

    setConcluido(true);
    setEnviando(false);
  }

  if (concluido) {
    return (
      <div className="flex items-start gap-3 rounded-card bg-herval-verde/15 px-5 py-4 text-sm font-bold text-herval-preto">
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Cadastro recebido. Mandamos um e-mail de confirmação para você — só
          depois de clicar no link de dentro dele o login libera.
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-6" noValidate>
      <Campo
        nome="nome_completo"
        etiqueta="Nome completo"
        valores={valores}
        aoMudar={mudar}
        obrigatorio
        exemplo="Ex.: Ana Martins"
        autoCompletar="name"
      />
      <Campo
        nome="email"
        etiqueta="E-mail"
        tipo="email"
        valores={valores}
        aoMudar={mudar}
        obrigatorio
        exemplo="voce@clinica.com.br"
        autoCompletar="email"
      />
      <Campo
        nome="cpf_cnpj"
        etiqueta="CPF ou CNPJ"
        valores={valores}
        aoMudar={mudar}
        obrigatorio
        exemplo="Só os números"
        limite={18}
      />
      <Campo
        nome="codigo_acesso"
        etiqueta="Código de acesso"
        valores={valores}
        aoMudar={mudar}
        obrigatorio
        exemplo="Ex.: A7KPX93M"
        ajuda="O código que a Herval mandou por um canal diferente do link."
        limite={8}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          nome="senha"
          etiqueta="Senha"
          tipo="password"
          valores={valores}
          aoMudar={mudar}
          obrigatorio
          ajuda="Pelo menos 8 caracteres."
          autoCompletar="new-password"
        />
        <Campo
          nome="confirmar_senha"
          etiqueta="Confirmar senha"
          tipo="password"
          valores={valores}
          aoMudar={mudar}
          obrigatorio
          autoCompletar="new-password"
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
        className={`${botaoPrincipal} w-full justify-center`}
      >
        {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
        {enviando ? "Enviando…" : "Concluir cadastro"}
      </button>
    </form>
  );
}
