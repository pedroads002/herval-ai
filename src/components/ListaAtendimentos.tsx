"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";
import { useLeads } from "@/components/ProvedorLeads";
import { ehDoLead, indexarMensagens, ultimaMensagem } from "@/data/mensagens";
import { nomeDaClinica } from "@/data/clinicas";
import { minutosDeDias, tempoRelativo } from "@/lib/tempo";
import { situacaoDaEtapa, type Tarefa } from "@/data/tarefas";

/**
 * Venda Ganha e Venda Perdida não pedem atendimento, mesmo quando a última
 * fala foi do lead — "amei o resultado, obrigada" não é uma pergunta em
 * aberto. A regra sai de `situacaoDaEtapa`, a mesma que a Fila de Tarefas e o
 * Funil usam, para as três telas não discordarem sobre o mesmo lead.
 */
function encerrado(tarefa: Tarefa) {
  const situacao = situacaoDaEtapa(tarefa.etapa);
  return situacao === "Ganho" || situacao === "Desqualificado";
}

/**
 * Uma conversa da lista: o lead mais o resumo do último turno de fala.
 *
 * `esperaEmMinutos` é o que ordena a tela, e vale para os dois casos em que a
 * bola está com a equipe: o lead falou e ninguém respondeu, ou ninguém falou
 * nada desde que ele chegou. Nos dois, a conta é a mesma — há quanto tempo
 * essa pessoa está sem retorno.
 */
type Conversa = {
  tarefa: Tarefa;
  trecho: string;
  quando: number;
  aguardando: boolean;
  fechado: boolean;
  esperaEmMinutos: number;
};

export default function ListaAtendimentos() {
  const { tarefas, mensagens } = useLeads();
  const [busca, setBusca] = useState("");

  // A conversa inteira é varrida uma vez, e não uma vez por linha da lista.
  const porLead = useMemo(() => indexarMensagens(mensagens), [mensagens]);

  const conversas = useMemo<Conversa[]>(
    () =>
      tarefas.map((tarefa) => {
        const ultima = ultimaMensagem(porLead, tarefa.id);
        const chegada = minutosDeDias(tarefa.diasAtras);
        const fechado = encerrado(tarefa);

        if (!ultima) {
          return {
            tarefa,
            trecho: "Nenhuma mensagem ainda.",
            quando: chegada,
            aguardando: !fechado,
            fechado,
            esperaEmMinutos: chegada,
          };
        }

        const doLead = ehDoLead(ultima);
        return {
          tarefa,
          trecho:
            (doLead ? "" : "Você: ") +
            (ultima.formato === "audio" ? "Áudio" : ultima.texto),
          quando: ultima.minutosAtras,
          aguardando: doLead && !fechado,
          fechado,
          esperaEmMinutos: ultima.minutosAtras,
        };
      }),
    [tarefas, porLead],
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo === "") return conversas;
    return conversas.filter(
      ({ tarefa }) =>
        tarefa.lead.toLowerCase().includes(termo) ||
        tarefa.telefone.toLowerCase().includes(termo),
    );
  }, [conversas, busca]);

  /**
   * Quem espera há mais tempo aparece primeiro — e não quem falou por último.
   * A lista existe para responder "quem atendo agora", e o mais recente é
   * justamente quem pode esperar mais um pouco.
   */
  const aguardando = useMemo(
    () =>
      visiveis
        .filter((c) => c.aguardando)
        .sort((a, b) => b.esperaEmMinutos - a.esperaEmMinutos),
    [visiveis],
  );

  /** Em andamento, bola com o lead: aqui sim o mais recente primeiro. */
  const respondidos = useMemo(
    () =>
      visiveis
        .filter((c) => !c.aguardando && !c.fechado)
        .sort((a, b) => a.quando - b.quando),
    [visiveis],
  );

  /** Ganhos e perdidos ficam por último: existem para consulta, não para agir. */
  const fechados = useMemo(
    () => visiveis.filter((c) => c.fechado).sort((a, b) => a.quando - b.quando),
    [visiveis],
  );

  return (
    <div className="space-y-7">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="w-full rounded-full border border-black/15 bg-herval-branco py-3 pl-11 pr-4 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
        />
      </div>

      <Secao
        titulo="Aguardando resposta"
        descricao="O lead falou por último, ou ainda não foi contatado."
        conversas={aguardando}
        vazio="Nenhum lead esperando resposta agora."
        destacado
      />

      <Secao
        titulo="Já respondidos"
        descricao="A última mensagem foi da clínica."
        conversas={respondidos}
        vazio="Nenhuma conversa respondida ainda."
      />

      <Secao
        titulo="Encerrados"
        descricao="Venda ganha ou perdida. Ficam aqui só para consulta."
        conversas={fechados}
        vazio="Nenhuma conversa encerrada."
      />
    </div>
  );
}

function Secao({
  titulo,
  descricao,
  conversas,
  vazio,
  destacado = false,
}: {
  titulo: string;
  descricao: string;
  conversas: Conversa[];
  vazio: string;
  destacado?: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-herval-preto">
          {titulo}
        </h2>
        <span
          className={[
            "rounded-full px-2.5 py-0.5 text-xs font-extrabold",
            destacado && conversas.length > 0
              ? "bg-herval-verde text-herval-preto"
              : "border border-black/15 text-black/55",
          ].join(" ")}
        >
          {conversas.length}
        </span>
        <p className="text-xs font-medium text-black/45">{descricao}</p>
      </div>

      {conversas.length === 0 ? (
        <p className="rounded-card border border-black/10 bg-herval-branco px-5 py-6 text-sm font-medium text-black/50 shadow-card">
          {vazio}
        </p>
      ) : (
        <ul className="space-y-2">
          {conversas.map((conversa) => (
            <LinhaDaConversa key={conversa.tarefa.id} conversa={conversa} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LinhaDaConversa({ conversa }: { conversa: Conversa }) {
  const { tarefa, trecho, quando, aguardando } = conversa;

  return (
    <li>
      <Link
        href={`/atendimento/${tarefa.id}`}
        className="flex items-center gap-4 rounded-card border border-black/10 bg-herval-branco px-5 py-4 shadow-card transition-colors hover:border-herval-verde"
      >
        <span
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            aguardando
              ? "bg-herval-verde text-herval-preto"
              : "bg-black/[0.06] text-black/40",
          ].join(" ")}
        >
          <MessageSquare className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="font-bold text-herval-preto">{tarefa.lead}</p>
            <p className="text-xs font-medium text-black/45">
              {nomeDaClinica(tarefa.clinicaId)} · {tarefa.origem}
            </p>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-black/60">
            {trecho}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-xs font-bold text-black/45">
            {tempoRelativo(quando)}
          </span>
          <span className="rounded-full bg-herval-verde/15 px-2.5 py-1 text-[11px] font-bold text-herval-preto">
            {tarefa.etapa}
          </span>
        </div>
      </Link>
    </li>
  );
}
