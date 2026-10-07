"use client";

import { useState } from "react";
import { Bot, Loader2, UserRound, X } from "lucide-react";
import { useLeads } from "@/components/ProvedorLeads";
import {
  atribuicoesDeTarefa,
  type AtribuicaoTarefa,
  type OpcaoDeLead,
} from "@/data/tarefas";
import { LIMITE_DA_DESCRICAO } from "@/lib/dados/linhaDeTarefa";

/**
 * O formulário de criar tarefa à mão.
 *
 * Mora num componente só e aparece em dois lugares: na Fila de Tarefas, onde o
 * lead é escolhido numa lista, e na conversa do Atendimento, onde o lead já é
 * aquele da tela. Dois formulários parecidos divergiriam na primeira mudança —
 * e a diferença entre os dois lugares é exatamente um campo.
 *
 * Por que o prazo é um campo só, de data e hora: foi o que a operação pediu.
 * "Retornar o contato na quinta às 14:30" não é uma contagem a partir de agora,
 * e obrigar a escolher entre 30 minutos, 2 horas ou 1 dia transformaria o
 * registro do trabalho no que o sistema sabe representar.
 */
export default function FormularioDeTarefa({
  leadFixo,
  aoCriar,
  aoFechar,
}: {
  /**
   * O lead desta tarefa, quando a tela já sabe qual é — é o caso do
   * Atendimento. Ausente na Fila, onde ele é escolhido na lista.
   */
  leadFixo?: { id: number; nome: string };
  /**
   * Chamado quando a tarefa foi gravada. A Fila usa isto para largar o filtro
   * de situação: o padrão dela é "Ativos", que filtra pela etapa do lead, e uma
   * tarefa criada para um lead já agendado nasceria invisível. Criar e não ver
   * é indistinguível de não ter criado.
   */
  aoCriar?: () => void;
  aoFechar: () => void;
}) {
  const { leadsParaTarefa, criarTarefaNaFila } = useLeads();

  const [leadId, setLeadId] = useState<string>(
    leadFixo ? String(leadFixo.id) : "",
  );
  const [atribuidoA, setAtribuidoA] = useState<AtribuicaoTarefa>("CRC");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const semLeads = !leadFixo && leadsParaTarefa.length === 0;

  async function salvar() {
    const id = Number(leadId);
    const quando = new Date(prazo);

    // A conversão para ISO é feita aqui, no navegador, de propósito: o campo
    // devolve "2026-10-08T14:30" sem fuso, e quem escolheu estava olhando o
    // relógio da própria mesa. Montar o instante no servidor, que roda em UTC,
    // deslocaria o prazo em três horas sem nenhum erro aparecer.
    if (Number.isNaN(quando.getTime())) {
      setAviso("Escolha a data e a hora do prazo.");
      return;
    }

    setSalvando(true);
    setAviso(null);

    const recusa = await criarTarefaNaFila({
      leadId: id,
      descricao,
      atribuidoA,
      prazoEm: quando.toISOString(),
    });

    setSalvando(false);

    if (recusa !== null) {
      setAviso(recusa);
      return;
    }

    // Fica na tela por um instante dizendo que deu certo: fechar na hora, em
    // cima do clique, deixa a dúvida de se a tarefa foi criada mesmo.
    setPronto(true);
    setDescricao("");
    setPrazo("");
    aoCriar?.();
  }

  if (pronto) {
    return (
      <div className="rounded-card border border-herval-verde/40 bg-herval-verde/10 p-5">
        <p className="text-sm font-bold text-herval-preto">
          Tarefa criada e já na fila.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPronto(false)}
            className="rounded-full border border-black/15 px-4 py-2 text-xs font-extrabold text-black/70 transition-colors hover:border-herval-verde hover:text-herval-preto"
          >
            Criar outra
          </button>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-full bg-herval-preto px-4 py-2 text-xs font-extrabold text-herval-branco transition-colors hover:bg-black/85"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-black/15 bg-herval-branco p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold tracking-tight text-herval-preto">
            Nova tarefa
          </h2>
          <p className="mt-0.5 text-xs font-medium text-black/55">
            {leadFixo
              ? `Para ${leadFixo.nome}, o lead desta conversa.`
              : "Escolha o lead, para quem é a tarefa e para quando."}
          </p>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="shrink-0 rounded-full p-1.5 text-black/45 transition-colors hover:bg-black/5 hover:text-herval-preto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {semLeads ? (
        <p className="mt-4 rounded-controle bg-black/[0.04] px-3 py-2 text-sm font-medium text-black/60">
          Não há lead no banco para receber uma tarefa. Toda tarefa pertence a
          um lead.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {!leadFixo && (
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-black/45">
                Lead
              </span>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="mt-1.5 w-full rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25"
              >
                <option value="">Escolha o lead</option>
                {leadsParaTarefa.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {rotuloDoLead(lead)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-black/45">
              De quem é a tarefa
            </span>
            <div className="mt-1.5 flex gap-2">
              {atribuicoesDeTarefa.map((opcao) => {
                const escolhida = atribuidoA === opcao;
                const Icone = opcao === "IA" ? Bot : UserRound;
                return (
                  <button
                    key={opcao}
                    type="button"
                    aria-pressed={escolhida}
                    onClick={() => setAtribuidoA(opcao)}
                    className={[
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition-colors",
                      escolhida
                        ? "bg-herval-preto text-herval-branco"
                        : "border border-black/15 text-black/70 hover:border-herval-verde hover:text-herval-preto",
                    ].join(" ")}
                  >
                    <Icone className="h-3.5 w-3.5" />
                    {opcao === "IA" ? "IA (Helô)" : "CRC humano"}
                  </button>
                );
              })}
            </div>

            {/*
              A IA ainda não executa tarefa criada à mão: o n8n escreve nesta
              tabela, nunca lê. Dizer isto aqui é o que impede o CRC de achar
              que passou o trabalho adiante e ir embora.
            */}
            {atribuidoA === "IA" && (
              <p className="mt-2 rounded-controle bg-black/[0.04] px-3 py-2 text-xs font-medium text-black/60">
                A Helô ainda não executa tarefa criada à mão. A tarefa fica
                registrada e pendente na fila até isso existir no cérebro dela.
              </p>
            )}
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-black/45">
              Prazo: data e hora
            </span>
            <input
              type="datetime-local"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="mt-1.5 w-full rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25"
            />
          </label>

          <label className="block">
            <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-black/45">
              <span>Motivo da tarefa</span>
              <span
                className={
                  descricao.length > LIMITE_DA_DESCRICAO
                    ? "text-herval-preto"
                    : ""
                }
              >
                {descricao.length}/{LIMITE_DA_DESCRICAO}
              </span>
            </span>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que precisa ser feito e por quê. Ex.: retornar o contato, o lead pediu para ligar depois das 14h."
              className="mt-1.5 w-full resize-none rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25"
            />
          </label>

          {aviso && (
            <p className="rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto">
              {aviso}
            </p>
          )}

          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-herval-verde px-4 py-2.5 text-xs font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
          >
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {salvando ? "Criando…" : "Criar tarefa"}
          </button>
        </div>
      )}
    </div>
  );
}

/** "Maria Souza · (51) 96146-8628 · Clínica Alfa" */
function rotuloDoLead(lead: OpcaoDeLead) {
  return [lead.nome, lead.telefone, lead.cliente]
    .filter((parte) => (parte ?? "") !== "")
    .join(" · ");
}
