"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import MenuDeEtapa, { type PassoDoMenu } from "@/components/MenuDeEtapa";
import { moverLeadDeEtapa } from "@/lib/acoes/funil";
import { ETAPA_GANHA, type EtapaFunil } from "@/data/leads";
import type { DadosDaMovimentacao } from "@/components/ProvedorLeads";

/**
 * O selo da etapa no cabeçalho do Atendimento, que agora também troca a etapa.
 *
 * Usa o mesmo `MenuDeEtapa` do card do Funil e a mesma ação de servidor
 * (`moverLeadDeEtapa`), então as regras são as mesmas nas duas telas:
 * - Venda Perdida pede o motivo da lista antes de mover;
 * - Venda Ganha não move por aqui: abre o modal de vendas (`aoPedirVenda`), e é
 *   a gravação da venda, com valor e procedimento, que leva o lead para lá;
 * - as demais etapas movem direto.
 *
 * O selo só muda depois de o servidor confirmar (`aoMovido`), nunca antes.
 */
export default function TrocarEtapa({
  leadId,
  etapa,
  aoMovido,
  aoPedirVenda,
}: {
  leadId: number;
  etapa: EtapaFunil;
  aoMovido: (etapa: EtapaFunil) => void;
  aoPedirVenda: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState<PassoDoMenu>("etapa");
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);

  // Fecha clicando fora ou no Esc, como os outros menus do cabeçalho.
  useEffect(() => {
    if (!aberto) return;

    function aoClicar(evento: MouseEvent) {
      if (!caixaRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  async function mover(destino: EtapaFunil, dados?: DadosDaMovimentacao) {
    setAberto(false);
    setPasso("etapa");
    setErro(null);

    if (destino === ETAPA_GANHA) {
      aoPedirVenda();
      return;
    }

    setGravando(true);
    try {
      const resultado = await moverLeadDeEtapa(
        leadId,
        destino,
        dados?.motivoPerda ?? null,
      );
      if (resultado.ok) aoMovido(destino);
      else setErro(resultado.mensagem);
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <div ref={caixaRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setAberto((atual) => !atual);
          setPasso("etapa");
          setErro(null);
        }}
        disabled={gravando}
        aria-expanded={aberto}
        title="Trocar a etapa deste lead no Funil"
        className="inline-flex h-9 items-center gap-1 rounded-full bg-herval-verde/15 px-3.5 text-xs font-bold text-herval-preto transition-colors hover:bg-herval-verde/25 disabled:opacity-60"
      >
        {gravando ? "Movendo..." : etapa}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {aberto && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-controle border border-black/10 bg-herval-branco p-2.5 shadow-card">
          <MenuDeEtapa
            etapaAtual={etapa}
            passo={passo}
            aoPedirPasso={setPasso}
            aoMover={mover}
          />
        </div>
      )}

      {erro && (
        <p className="absolute right-0 z-30 mt-2 w-64 rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-bold text-herval-vermelho">
          {erro}
        </p>
      )}
    </div>
  );
}
