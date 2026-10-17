"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { moverLeadDeEtapa } from "@/lib/acoes/funil";
import { apoioDoMotivo } from "@/components/MenuDeEtapa";
import { ETAPA_PERDIDA, motivosDePerda, type MotivoPerda } from "@/data/leads";

/**
 * O modal de "Marcar como perdido", aberto a partir da conversa individual do
 * Atendimento.
 *
 * Não duplica regra nenhuma: chama `moverLeadDeEtapa`, a mesma ação de
 * servidor que o Funil já usa para mover um card para "Venda Perdida" — só
 * passa a existir também aqui. O motivo vem da mesma lista fechada do Funil
 * (`motivosDePerda`, em `@/data/leads`), com a mesma explicação de apoio do
 * "Spam" que o menu do card já mostra (`apoioDoMotivo`, em
 * `@/components/MenuDeEtapa`) — duas listas divergentes seriam dois jeitos de
 * contar a mesma coisa nos relatórios.
 *
 * Sem campo de observação: a linha do banco (`leads.motivo_perda`) só guarda o
 * motivo, exatamente como o Funil já grava. Um campo de texto aqui só para
 * não ir a lugar nenhum seria pior que não ter o campo.
 */
export default function MarcarComoPerdido({
  leadId,
  leadNome,
  aoFechar,
  aoMarcado,
}: {
  leadId: number;
  leadNome: string;
  aoFechar: () => void;
  /** Chamado só depois de o servidor confirmar a gravação. */
  aoMarcado: () => void;
}) {
  const [motivo, setMotivo] = useState<MotivoPerda | "">("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const botaoFecharRef = useRef<HTMLButtonElement>(null);

  // Foco entra no modal ao abrir, Esc fecha, e nada aqui depende de o
  // formulário ser reaberto: o componente inteiro desmonta quando fecha.
  useEffect(() => {
    botaoFecharRef.current?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") aoFechar();
    }

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  async function confirmar() {
    if (motivo === "") {
      setErro("Escolha o motivo da perda.");
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const resultado = await moverLeadDeEtapa(leadId, ETAPA_PERDIDA, motivo);

      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }

      aoMarcado();
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-marcar-perdido"
        className="w-full max-w-sm rounded-card border border-black/10 bg-herval-branco p-5 shadow-card"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="titulo-marcar-perdido"
              className="text-sm font-extrabold tracking-tight text-herval-preto"
            >
              Marcar lead como perdido
            </h2>
            <p className="mt-0.5 truncate text-xs font-medium text-black/55">
              {leadNome}
            </p>
          </div>
          <button
            ref={botaoFecharRef}
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-black/45 transition-colors hover:bg-black/5 hover:text-herval-preto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-black/45">
            Motivo da perda
          </span>
          <select
            value={motivo}
            onChange={(evento) => {
              setMotivo(evento.target.value as MotivoPerda);
              setErro(null);
            }}
            className="mt-1.5 w-full rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25"
          >
            <option value="">Escolha o motivo</option>
            {motivosDePerda.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {motivo !== "" && apoioDoMotivo[motivo] && (
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-black/45">
              {apoioDoMotivo[motivo]}
            </p>
          )}
        </label>

        {erro && (
          <p
            role="alert"
            className="mt-3 rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto"
          >
            {erro}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-full border border-black/15 px-4 py-2 text-xs font-extrabold text-black/70 transition-colors hover:border-herval-verde hover:text-herval-preto"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={confirmar}
            className="inline-flex items-center gap-1.5 rounded-full bg-herval-preto px-4 py-2 text-xs font-extrabold text-herval-branco transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5 text-herval-vermelho" />
            {salvando ? "Marcando…" : "Marcar como perdido"}
          </button>
        </div>
      </div>
    </div>
  );
}
