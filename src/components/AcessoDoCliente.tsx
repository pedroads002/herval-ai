"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, KeyRound, Send } from "lucide-react";
import { Cartao, botaoPrincipal } from "@/components/cadastro/comuns";

/**
 * O acesso ao painel: gera o convite de autocadastro deste cliente.
 *
 * Fica fora do formulário de dados do cliente de propósito — gerar convite
 * não é editar cadastro, é uma ação própria, com resultado próprio (link e
 * código), que precisa ficar visível depois do clique e não some se a tela
 * revalidar os dados do cliente.
 *
 * O link e o código só existem aqui, nesta resposta. Depois de saída desta
 * tela (ou de um F5), ninguém — nem a Herval — consegue ver o código de novo;
 * só gerar um novo convite, que aposenta este.
 */
export default function AcessoDoCliente({ clienteId }: { clienteId: number }) {
  const [estado, setEstado] = useState<
    | { situacao: "ocioso" }
    | { situacao: "gerando" }
    | { situacao: "erro"; motivo: string }
    | { situacao: "pronto"; link: string; codigo: string; validoAte: string }
  >({ situacao: "ocioso" });

  async function gerar() {
    setEstado({ situacao: "gerando" });

    const resposta = await fetch("/api/admin/convidar-cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicaId: clienteId }),
    }).catch(() => null);

    const corpo = await resposta?.json().catch(() => null);

    if (!resposta || !corpo?.ok) {
      setEstado({
        situacao: "erro",
        motivo: corpo?.motivo || "Não deu para gerar o convite. Tente de novo.",
      });
      return;
    }

    setEstado({
      situacao: "pronto",
      link: corpo.link,
      codigo: corpo.codigoAcesso,
      validoAte: corpo.expiraEm,
    });
  }

  return (
    <Cartao titulo="Acesso ao painel">
      <p className="mb-5 max-w-2xl text-sm font-medium text-black/55">
        Gera um link de autocadastro para este cliente. Ele preenche o próprio
        nome, e-mail, CPF/CNPJ e senha — e só entra depois de confirmar o
        e-mail. Envie o link e o código por canais diferentes (ex.: link por
        e-mail, código por WhatsApp): quem só tiver um dos dois não completa
        o cadastro.
      </p>

      {estado.situacao !== "pronto" && (
        <button
          type="button"
          onClick={gerar}
          disabled={estado.situacao === "gerando"}
          className={botaoPrincipal}
        >
          <Send className="h-4 w-4" />
          {estado.situacao === "gerando" ? "Gerando…" : "Convidar cliente"}
        </button>
      )}

      {estado.situacao === "erro" && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-controle bg-herval-vermelho/10 px-3.5 py-3 text-sm font-medium text-herval-vermelho"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {estado.motivo}
        </p>
      )}

      {estado.situacao === "pronto" && (
        <div className="space-y-4">
          <LinhaDeCopiar etiqueta="Link do convite" valor={estado.link} />
          <LinhaDeCopiar
            etiqueta="Código de acesso"
            valor={estado.codigo}
            icone={<KeyRound className="h-3.5 w-3.5" />}
          />
          <p className="text-xs font-medium text-black/45">
            Válido até{" "}
            {new Date(estado.validoAte).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            . Gerar um novo convite aposenta este.
          </p>
          <button
            type="button"
            onClick={() => setEstado({ situacao: "ocioso" })}
            className="text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
          >
            Gerar outro convite
          </button>
        </div>
      )}
    </Cartao>
  );
}

function LinhaDeCopiar({
  etiqueta,
  valor,
  icone,
}: {
  etiqueta: string;
  valor: string;
  icone?: React.ReactNode;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(valor).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div>
      <p className="mb-2 block text-xs font-bold uppercase tracking-wide text-black/50">
        {etiqueta}
      </p>
      <div className="flex items-center gap-2">
        <span className="flex flex-1 items-center gap-1.5 truncate rounded-controle border border-black/15 bg-black/[0.02] px-3.5 py-2.5 text-sm font-bold text-herval-preto">
          {icone}
          {valor}
        </span>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/15 px-3.5 py-2.5 text-xs font-bold text-black/70 transition-colors hover:border-herval-verde hover:text-herval-preto"
        >
          {copiado ? (
            <Check className="h-3.5 w-3.5 text-herval-verde" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
