"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { salvarPerfil } from "@/lib/acoes/perfil";
import { LIMITE_DO_NOME } from "@/lib/dados/perfilDoUsuario";

/**
 * Nome e sobrenome de quem está logado.
 *
 * Não é cadastro de pessoa da equipe: é o nome que assina o que *esta* conta
 * grava. São contas diferentes — a da agência e a de cada pessoa — e cada uma
 * assina com o nome que estiver aqui.
 *
 * O e-mail aparece, mas não se edita: ele é o login, e trocá-lo no painel
 * criaria uma assinatura que discorda de quem entrou.
 */
export default function FormularioDePerfil({
  nomeInicial,
  sobrenomeInicial,
  email,
}: {
  nomeInicial: string;
  sobrenomeInicial: string;
  email: string;
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [sobrenome, setSobrenome] = useState(sobrenomeInicial);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);

  async function enviar() {
    setSalvando(true);
    setAviso(null);
    setPronto(null);

    const resultado = await salvarPerfil({ nome, sobrenome });

    setSalvando(false);

    if (!resultado.ok) {
      setAviso(resultado.mensagem);
      return;
    }
    setPronto(resultado.mensagem);
  }

  const assinatura = [nome.trim(), sobrenome.trim()]
    .filter((parte) => parte !== "")
    .join(" ");

  return (
    <div className="max-w-xl rounded-card border border-black/15 bg-herval-branco p-5 shadow-card">
      <div className="space-y-4">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-black/45">
            Nome
          </span>
          <input
            type="text"
            value={nome}
            maxLength={LIMITE_DO_NOME}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Equipe"
            className="mt-1.5 w-full rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm font-medium text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-black/45">
            Sobrenome{" "}
            <span className="font-medium normal-case">(opcional)</span>
          </span>
          <input
            type="text"
            value={sobrenome}
            maxLength={LIMITE_DO_NOME}
            onChange={(e) => setSobrenome(e.target.value)}
            placeholder="Ex.: Herval"
            className="mt-1.5 w-full rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm font-medium text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25"
          />
        </label>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-black/45">
            E-mail de acesso
          </span>
          <p className="mt-1.5 break-all rounded-controle bg-black/[0.04] px-3 py-2 text-sm font-medium text-black/60">
            {email}
          </p>
          <p className="mt-1.5 text-xs font-medium text-black/45">
            É o login desta conta. Não muda por aqui.
          </p>
        </div>

        {/*
          A pessoa vê a assinatura antes de salvar. O nome não fica só nesta
          tela: ele passa a aparecer em tarefa criada à mão, nota, mensagem do
          CRC e movimentação do Funil — e o que já foi gravado antes continua
          com o que estava lá na hora.
        */}
        {assinatura !== "" && (
          <p className="rounded-controle bg-herval-verde/10 px-3 py-2 text-xs font-medium text-black/70">
            O que você gravar vai assinado como{" "}
            <strong className="font-extrabold text-herval-preto">
              {assinatura}
            </strong>
            .
          </p>
        )}

        {aviso && (
          <p className="rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto">
            {aviso}
          </p>
        )}

        {pronto && (
          <p className="rounded-controle border border-herval-verde/40 bg-herval-verde/10 px-3 py-2 text-xs font-bold text-herval-preto">
            {pronto}
          </p>
        )}

        <button
          type="button"
          disabled={salvando}
          onClick={enviar}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-herval-verde px-5 py-2.5 text-xs font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
        >
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {salvando ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}
