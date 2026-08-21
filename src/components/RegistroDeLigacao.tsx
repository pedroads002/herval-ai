"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motivosDePerda, type MotivoPerda } from "@/data/leads";
import type { CanalDeLigacao, DesfechoDaLigacao } from "@/data/ligacoes";
import { apoioDoMotivo } from "@/components/MenuDeEtapa";
import type { ResultadoDaConversa, SituacaoDaRegua } from "@/lib/regua";

const nomeDoCanal: Record<CanalDeLigacao, string> = {
  discador: "Discador",
  whatsapp: "WhatsApp",
};

const canais: CanalDeLigacao[] = ["discador", "whatsapp"];

/**
 * Os motivos que costumam aparecer numa ligação de primeiro contato. Ficam em
 * destaque, mas a lista inteira continua disponível: "Venda Perdida" sempre
 * exigiu a lista fechada completa, e a via de entrada não muda isso — o lead
 * pode dizer no telefone que já fechou em outra clínica.
 */
const motivosDeLigacao: MotivoPerda[] = [
  "Clicou errado",
  "Não atende o procedimento",
  "Localização distante",
];

type Passo = "desfecho" | "resultado" | "motivo";

export default function RegistroDeLigacao({
  situacao,
  aoRegistrar,
}: {
  situacao: SituacaoDaRegua;
  aoRegistrar: (
    canal: CanalDeLigacao,
    desfecho: DesfechoDaLigacao,
    resultado?: ResultadoDaConversa,
    motivoPerda?: MotivoPerda,
  ) => void;
}) {
  const [canal, setCanal] = useState<CanalDeLigacao>(situacao.canalDaProxima);
  const [passo, setPasso] = useState<Passo>("desfecho");

  const esgotada = situacao.estado === "sequencia-esgotada";

  return (
    <div className="w-72 rounded-controle border border-black/10 bg-herval-branco p-3 shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-wide text-black/45">
        {situacao.proximaTentativa}ª tentativa
      </p>

      {esgotada && (
        <p className="mt-1.5 rounded bg-black/[0.05] px-2.5 py-1.5 text-[11px] font-medium leading-snug text-black/60">
          A sequência prevista já foi cumprida. Dá para registrar assim mesmo —
          o que aconteceu de verdade tem que caber aqui.
        </p>
      )}

      {passo === "desfecho" && (
        <>
          <div className="mt-3 flex gap-1.5">
            {canais.map((opcao) => {
              const escolhido = opcao === canal;
              const naRegua = opcao === situacao.canalDaProxima;
              return (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setCanal(opcao)}
                  aria-pressed={escolhido}
                  className={[
                    "flex-1 rounded-controle px-2 py-1.5 text-[11px] font-bold transition-colors",
                    escolhido
                      ? "bg-herval-preto text-herval-branco"
                      : "border border-black/15 text-black/60 hover:text-herval-preto",
                  ].join(" ")}
                >
                  {nomeDoCanal[opcao]}
                  <span
                    className={[
                      "mt-0.5 block text-[10px] font-medium",
                      escolhido ? "text-herval-branco/60" : "text-black/40",
                    ].join(" ")}
                  >
                    {naRegua && !esgotada ? "na régua" : "fora da régua"}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-black/45">
            O lead atendeu?
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPasso("resultado")}
              className="flex-1 rounded-full bg-herval-verde px-3 py-1.5 text-[11px] font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
            >
              Atendeu
            </button>
            <button
              type="button"
              onClick={() => aoRegistrar(canal, "não atendida")}
              className="flex-1 rounded-full border border-black/20 px-3 py-1.5 text-[11px] font-bold text-black/60 transition-colors hover:text-herval-preto"
            >
              Não atendeu
            </button>
          </div>
        </>
      )}

      {passo === "resultado" && (
        <>
          <Voltar aoVoltar={() => setPasso("desfecho")} />
          <p className="pb-2 text-[11px] font-bold uppercase tracking-wide text-black/45">
            O que saiu da conversa?
          </p>
          <div className="space-y-1.5">
            <Opcao
              titulo="Converteu o agendamento"
              apoio="abre o formulário: a etapa vem de lá"
              aoEscolher={() => aoRegistrar(canal, "atendida", "converteu")}
            />
            <Opcao
              titulo="Conversou, não fechou"
              apoio="o lead vira lead em conversa"
              aoEscolher={() => aoRegistrar(canal, "atendida", "nao-converteu")}
            />
            <Opcao
              titulo="Desqualificou na ligação"
              apoio="pede o motivo, como em qualquer Venda Perdida"
              aoEscolher={() => setPasso("motivo")}
            />
          </div>
        </>
      )}

      {passo === "motivo" && (
        <>
          <Voltar aoVoltar={() => setPasso("resultado")} />
          <p className="pb-2 text-[11px] font-bold uppercase tracking-wide text-black/45">
            Motivo da perda
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {[...motivosDeLigacao, ...motivosDePerda.filter((m) => !motivosDeLigacao.includes(m))].map(
              (motivo, indice) => (
                <li key={motivo}>
                  {indice === motivosDeLigacao.length && (
                    <p className="px-1 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-black/30">
                      Outros motivos
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      aoRegistrar(canal, "atendida", "desqualificou", motivo)
                    }
                    className={[
                      "w-full rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-herval-verde/20 hover:text-herval-preto",
                      indice < motivosDeLigacao.length
                        ? "font-bold text-herval-preto"
                        : "font-medium text-black/65",
                    ].join(" ")}
                  >
                    {motivo}
                    {apoioDoMotivo[motivo] && (
                      <span className="mt-0.5 block text-[11px] font-normal leading-snug text-black/45">
                        {apoioDoMotivo[motivo]}
                      </span>
                    )}
                  </button>
                </li>
              ),
            )}
          </ul>
        </>
      )}

      <p className="mt-3 text-[11px] font-medium leading-snug text-black/45">
        A ligação é sempre do CRC. O canal é sugestão da régua, não trava.
      </p>
    </div>
  );
}

function Opcao({
  titulo,
  apoio,
  aoEscolher,
}: {
  titulo: string;
  apoio: string;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      className="w-full rounded-controle border border-black/10 px-2.5 py-2 text-left transition-colors hover:border-herval-verde hover:bg-herval-verde/10"
    >
      <span className="block text-xs font-bold text-herval-preto">{titulo}</span>
      <span className="mt-0.5 block text-[10px] font-medium leading-snug text-black/45">
        {apoio}
      </span>
    </button>
  );
}

function Voltar({ aoVoltar }: { aoVoltar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoVoltar}
      className="mb-2 mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-black/45 transition-colors hover:text-herval-preto"
    >
      <ArrowLeft className="h-3 w-3" />
      voltar
    </button>
  );
}
