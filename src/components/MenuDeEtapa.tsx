"use client";

import { ArrowRight } from "lucide-react";
import {
  ETAPA_PERDIDA,
  etapasFunil,
  motivosDePerda,
  type EtapaFunil,
  type MotivoPerda,
} from "@/data/leads";
import type { DadosDaMovimentacao } from "@/components/ProvedorLeads";

/**
 * O menu de mover o lead de etapa, com a exigência que a regra impõe: Venda
 * Perdida pede motivo da lista.
 *
 * Venda Ganha não pede nada. Ela pedia o valor da venda, e isso saiu: o
 * sistema não guarda nem exibe valor de nada nem de ninguém.
 *
 * Mora num arquivo próprio porque o Funil e a tela de atendimento movem o
 * mesmo lead — se cada uma tivesse a sua cópia, a regra passaria a valer só
 * onde alguém lembrasse de repeti-la.
 */
export type PassoDoMenu = "etapa" | "motivo";

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

  return (
    <ListaDeOpcoes
      titulo="Mover para"
      opcoes={etapasFunil.filter((destino) => destino !== etapaAtual)}
      aoEscolher={(destino) => {
        // Venda Perdida cobra o motivo antes de aceitar o movimento.
        if (destino === ETAPA_PERDIDA) return aoPedirPasso("motivo");
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
