"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronRight,
  FlaskConical,
  Info,
  RotateCcw,
  User,
  UserRound,
} from "lucide-react";
import { cenarios, type MensagemSimulada } from "@/data/testeIa";

export default function SimuladorIa() {
  const [cenarioId, setCenarioId] = useState(cenarios[0].id);
  const [visiveis, setVisiveis] = useState(1);
  const fimDaConversa = useRef<HTMLDivElement>(null);

  const cenario = cenarios.find((c) => c.id === cenarioId) ?? cenarios[0];
  const total = cenario.mensagens.length;
  const acabou = visiveis >= total;

  // Mantém a última mensagem à vista conforme a conversa avança.
  useEffect(() => {
    if (visiveis > 1) {
      fimDaConversa.current?.scrollIntoView({ block: "nearest" });
    }
  }, [visiveis]);

  function trocarCenario(id: string) {
    setCenarioId(id);
    setVisiveis(1);
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2.5 rounded-card border border-dashed border-black/25 bg-black/[0.03] px-5 py-4 text-sm font-medium text-black/70">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-herval-preto" />
        <span>
          <span className="font-extrabold text-herval-preto">
            Ambiente de teste: nada aqui é enviado a um lead real.
          </span>{" "}
          As conversas são roteiros fixos, montados com o tom da Estratégia da
          Clínica e as respostas da Quebra de Objeções, para a equipe conferir
          antes de qualquer coisa ir para o ar.
        </span>
      </p>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-black/45">
          Escolha o cenário
        </p>
        <div className="flex flex-wrap gap-2">
          {cenarios.map((opcao) => {
            const escolhido = opcao.id === cenario.id;
            return (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={escolhido}
                onClick={() => trocarCenario(opcao.id)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-bold transition-colors",
                  escolhido
                    ? "bg-herval-verde text-herval-preto"
                    : "border border-black/15 bg-herval-branco text-black/65 hover:border-black/30",
                ].join(" ")}
              >
                {opcao.nome}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm font-medium text-black/55">
          {cenario.descricao}
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        <div className="space-y-4 bg-black/[0.02] px-5 py-6 md:px-8">
          {cenario.mensagens.slice(0, visiveis).map((mensagem, indice) => (
            <Balao key={`${cenario.id}-${indice}`} mensagem={mensagem} />
          ))}
          <div ref={fimDaConversa} />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-black/10 px-5 py-4 md:px-8">
          {acabou ? (
            <button
              type="button"
              onClick={() => setVisiveis(1)}
              className="inline-flex items-center gap-2 rounded-controle border border-black/15 px-4 py-2.5 text-sm font-bold text-herval-preto transition-colors hover:border-black/35"
            >
              <RotateCcw className="h-4 w-4" />
              Recomeçar conversa
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setVisiveis((quantas) => quantas + 1)}
              className="inline-flex items-center gap-2 rounded-controle bg-herval-verde px-4 py-2.5 text-sm font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
            >
              Avançar conversa
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          <span role="status" className="text-sm font-medium text-black/55">
            Mensagem{" "}
            <span className="font-extrabold text-herval-preto">
              {Math.min(visiveis, total)}
            </span>{" "}
            de <span className="font-extrabold text-herval-preto">{total}</span>
            {acabou && " · fim do roteiro"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Balao({ mensagem }: { mensagem: MensagemSimulada }) {
  // Aviso do sistema: não é fala de ninguém, então fica centralizado.
  if (mensagem.autor === "Sistema") {
    return (
      <div className="flex justify-center">
        <div className="max-w-xl rounded-controle border border-dashed border-black/20 bg-herval-branco px-4 py-3 text-center">
          <p className="flex items-start gap-2 text-xs font-medium text-black/60">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {mensagem.texto}
          </p>
          {mensagem.fonte && <Fonte texto={mensagem.fonte} centralizado />}
        </div>
      </div>
    );
  }

  const doLead = mensagem.autor === "Lead";
  const Icone = doLead ? UserRound : mensagem.autor === "IA" ? Bot : User;

  const estilo = doLead
    ? "border border-black/10 bg-herval-branco text-herval-preto"
    : mensagem.autor === "IA"
      ? "bg-herval-verde text-herval-preto"
      : "bg-herval-preto text-herval-branco";

  return (
    <div className={`flex ${doLead ? "justify-start" : "justify-end"}`}>
      <div className="max-w-lg">
        <p
          className={[
            "mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-black/45",
            doLead ? "" : "justify-end",
          ].join(" ")}
        >
          <Icone className="h-3 w-3" />
          {mensagem.autor}
        </p>
        <div
          className={`rounded-card px-4 py-3 text-sm leading-relaxed ${estilo}`}
        >
          {mensagem.texto}
        </div>
        {mensagem.fonte && <Fonte texto={mensagem.fonte} />}
      </div>
    </div>
  );
}

/** Mostra de qual tela do sistema saiu aquele conteúdo. */
function Fonte({
  texto,
  centralizado = false,
}: {
  texto: string;
  centralizado?: boolean;
}) {
  return (
    <p
      className={`mt-1.5 text-[11px] font-medium text-black/40 ${
        centralizado ? "" : "text-right"
      }`}
    >
      Origem: {texto}
    </p>
  );
}
