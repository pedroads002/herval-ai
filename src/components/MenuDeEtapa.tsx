"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  ETAPA_GANHA,
  ETAPA_PERDIDA,
  etapasFunil,
  motivosDePerda,
  type EtapaFunil,
  type MotivoPerda,
} from "@/data/leads";
import type { DadosDaMovimentacao } from "@/components/ProvedorLeads";

/**
 * O menu de mover o lead de etapa, com as duas exigências que a regra impõe:
 * Venda Perdida pede motivo da lista e Venda Ganha pede o valor.
 *
 * Mora num arquivo próprio porque o Funil e a tela de atendimento movem o
 * mesmo lead — se cada uma tivesse a sua cópia, a regra passaria a valer só
 * onde alguém lembrasse de repeti-la.
 */
export type PassoDoMenu = "etapa" | "motivo" | "valor";

/**
 * Explicação curta em opções que o CRC costuma usar fora do lugar. Só "Spam"
 * precisa hoje: sem isso ele vira gaveta de lead que apenas esfriou, e esse
 * lead sairia da conta de qualificados sem ter deixado de ser lead de verdade.
 */
export const apoioDoMotivo: Record<string, string> = {
  Spam: "mensagens sem sentido, sem interação real — não usar para quem só parou de responder",
};

export default function MenuDeEtapa({
  etapaAtual,
  passo,
  aoPedirPasso,
  aoMover,
}: {
  etapaAtual: EtapaFunil;
  passo: PassoDoMenu;
  aoPedirPasso: (passo: PassoDoMenu) => void;
  aoMover: (etapa: EtapaFunil, dados?: DadosDaMovimentacao) => void;
}) {
  if (passo === "motivo") {
    return (
      <ListaDeOpcoes
        titulo="Motivo da perda"
        opcoes={motivosDePerda}
        apoios={apoioDoMotivo}
        aoEscolher={(motivo) =>
          aoMover(ETAPA_PERDIDA, { motivoPerda: motivo as MotivoPerda })
        }
      />
    );
  }

  if (passo === "valor") {
    return (
      <CampoDeValor aoConfirmar={(valorVenda) => aoMover(ETAPA_GANHA, { valorVenda })} />
    );
  }

  return (
    <ListaDeOpcoes
      titulo="Mover para"
      opcoes={etapasFunil.filter((destino) => destino !== etapaAtual)}
      aoEscolher={(destino) => {
        // Estas duas cobram informação antes de aceitar o movimento.
        if (destino === ETAPA_PERDIDA) return aoPedirPasso("motivo");
        if (destino === ETAPA_GANHA) return aoPedirPasso("valor");
        aoMover(destino as EtapaFunil);
      }}
    />
  );
}

function ListaDeOpcoes({
  titulo,
  opcoes,
  apoios,
  aoEscolher,
}: {
  titulo: string;
  opcoes: readonly string[];
  apoios?: Record<string, string>;
  aoEscolher: (opcao: string) => void;
}) {
  return (
    <>
      <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-black/45">
        {titulo}
      </p>
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {opcoes.map((opcao) => (
          <li key={opcao}>
            <button
              type="button"
              onClick={() => aoEscolher(opcao)}
              className="flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium text-black/70 transition-colors hover:bg-herval-verde/20 hover:font-bold hover:text-herval-preto"
            >
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {opcao}
                {apoios?.[opcao] && (
                  <span className="mt-0.5 block text-[11px] font-normal leading-snug text-black/45">
                    {apoios[opcao]}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Valor da venda: obrigatório para marcar Venda Ganha, e só o valor. */
function CampoDeValor({
  aoConfirmar,
}: {
  aoConfirmar: (valor: number) => void;
}) {
  const [texto, setTexto] = useState("");
  const valor = Number(texto.replace(",", "."));
  const valido = texto.trim() !== "" && Number.isFinite(valor) && valor > 0;

  return (
    <>
      <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-black/45">
        Valor da venda (R$)
      </p>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valido) aoConfirmar(valor);
        }}
        placeholder="0,00"
        className="w-full rounded border border-black/15 bg-herval-branco px-2.5 py-1.5 text-xs font-bold text-herval-preto outline-none focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/30"
      />
      <button
        type="button"
        disabled={!valido}
        onClick={() => aoConfirmar(valor)}
        className="mt-2 w-full rounded bg-herval-verde px-2 py-1.5 text-xs font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
      >
        Confirmar venda
      </button>
    </>
  );
}
