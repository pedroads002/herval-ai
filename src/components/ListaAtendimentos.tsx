"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListFilter, MessageSquare, Search } from "lucide-react";
import {
  ehAtendimento,
  ehDoLead,
  indexarMensagens,
  textoVisivel,
  ultimaFala,
  ultimaMensagem,
} from "@/data/mensagens";
import { tempoRelativo } from "@/lib/tempo";
import { situacaoDaEtapa } from "@/data/tarefas";
import {
  combinaComBusca,
  combinaComFiltro,
  filtrosDeSituacao,
  type FiltroDeSituacao,
} from "@/lib/filtros";
import type {
  LeadEmAtendimento,
  MensagemEmAtendimento,
} from "@/lib/dados/atendimento";

/** De quem foi a última fala, dito em duas palavras na frente do trecho. */
function prefixoDoTrecho(mensagem: MensagemEmAtendimento) {
  if (ehDoLead(mensagem)) return "";
  return ehAtendimento(mensagem) ? "Você: " : "Automático: ";
}

/**
 * Venda Ganha e Venda Perdida não pedem atendimento, mesmo quando a última
 * fala foi do lead — "amei o resultado, obrigada" não é uma pergunta em
 * aberto. A regra sai de `situacaoDaEtapa`, a mesma que a Fila de Tarefas e o
 * Funil usam, para as três telas não discordarem sobre o mesmo lead.
 */
function encerrado(lead: LeadEmAtendimento) {
  const situacao = situacaoDaEtapa(lead.etapa);
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
  lead: LeadEmAtendimento;
  trecho: string;
  quando: number;
  aguardando: boolean;
  fechado: boolean;
  esperaEmMinutos: number;
};

export default function ListaAtendimentos({
  leads,
  mensagens,
  falha,
}: {
  leads: LeadEmAtendimento[];
  mensagens: MensagemEmAtendimento[];
  falha: string | null;
}) {
  const [busca, setBusca] = useState("");
  /**
   * "Todos" e não "Ativos" como padrão: aqui a lista já separa por si o que
   * pede resposta do que é só histórico, então esconder metade da base na
   * abertura tiraria conversa de vista sem a pessoa ter pedido.
   */
  const [filtro, setFiltro] = useState<FiltroDeSituacao>("Todos");

  // A conversa inteira é varrida uma vez, e não uma vez por linha da lista.
  const porLead = useMemo(() => indexarMensagens(mensagens), [mensagens]);

  const conversas = useMemo<Conversa[]>(
    () =>
      leads.map((lead) => {
        const ultima = ultimaMensagem(porLead, lead.id);
        // A fila se decide pela última fala de verdade. Reação aparece na
        // conversa, mas não é turno: um ❤️ não devolve o lead para a espera,
        // nem reinicia a contagem de quanto tempo ele está sem resposta.
        const fala = ultimaFala(porLead, lead.id);
        const fechado = encerrado(lead);

        // Lead sem fala nenhuma: chegou e ninguém conversou com ele — ou só
        // reagiu a algo. É a fila mais antiga que existe, e por isso entra
        // pelo tempo de chegada.
        if (!fala) {
          return {
            lead,
            trecho: ultima ? textoVisivel(ultima) : "Nenhuma mensagem ainda.",
            quando: lead.minutosAtras,
            aguardando: !fechado,
            fechado,
            esperaEmMinutos: lead.minutosAtras,
          };
        }

        const atendida = ehAtendimento(fala);
        return {
          lead,
          // Mídia com legenda mostra a legenda; sem legenda, o rótulo do
          // formato. É a mesma função que a bolha da conversa usa, para a
          // lista e a tela do lead nunca discordarem sobre o que foi dito.
          //
          // O prefixo diz de quem foi a última fala. "Automático:" existe
          // separado de "Você:" porque ninguém da equipe escreveu aquilo — ler
          // "Você: recebi seu áudio" faria o CRC achar que já respondeu.
          // `ultima` existe sempre que `fala` existe, mas o compilador não
          // tem como saber: o `?? fala` é só para ele, e nunca é usado.
          trecho: prefixoDoTrecho(ultima ?? fala) + textoVisivel(ultima ?? fala),
          quando: (ultima ?? fala).minutosAtras,
          // Quem espera é quem ainda não foi atendido por gente ou pela IA.
          // Mensagem automática não tira o lead da fila: ela é o aviso de que
          // ele continua nela.
          aguardando: !atendida && !fechado,
          fechado,
          // A espera se conta desde a última fala, e não desde a reação: quem
          // perguntou há uma hora e reagiu a um emoji agora continua há uma
          // hora sem resposta, e não pode cair para o fim da fila por isso.
          esperaEmMinutos: fala.minutosAtras,
        };
      }),
    [leads, porLead],
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conversas.filter(({ lead }) => {
      const filtravel = { ...lead, clinica: lead.nomeDaClinica };
      return (
        combinaComBusca(filtravel, termo) && combinaComFiltro(filtravel, filtro)
      );
    });
  }, [conversas, busca, filtro]);

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

  /**
   * Falha de leitura não é lista vazia. Sem esta distinção, banco fora do ar e
   * fila realmente vazia viram a mesma tela em branco — e a primeira é um
   * defeito que o CRC interpretaria como "não tem ninguém para atender".
   */
  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-bold text-herval-preto">
          Não deu para carregar as conversas.
        </p>
        <p className="mt-1 text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Busca e filtro, no mesmo formato da Fila de Tarefas. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou clínica"
            className="w-full rounded-full border border-black/15 bg-herval-branco py-3 pl-11 pr-4 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
          />
        </div>

        <div className="relative shrink-0">
          <ListFilter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as FiltroDeSituacao)}
            aria-label="Filtrar por situação do lead"
            className="w-full rounded-full border border-black/15 bg-herval-branco py-3 pl-11 pr-5 text-sm font-bold text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20 sm:w-auto"
          >
            {filtrosDeSituacao.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">
          {visiveis.length}
        </span>{" "}
        {visiveis.length === 1 ? "conversa exibida" : "conversas exibidas"} de{" "}
        <span className="font-extrabold text-herval-preto">
          {conversas.length}
        </span>{" "}
        na fila.
      </p>

      <Secao
        titulo="Aguardando resposta"
        descricao="Ninguém da equipe nem a IA respondeu ainda. Aviso automático não conta como resposta."
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
            <LinhaDaConversa key={conversa.lead.id} conversa={conversa} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LinhaDaConversa({ conversa }: { conversa: Conversa }) {
  const { lead, trecho, quando, aguardando } = conversa;

  return (
    <li>
      <Link
        href={`/atendimento/${lead.id}`}
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
            <p className="font-bold text-herval-preto">{lead.lead}</p>
            <p className="text-xs font-medium text-black/45">
              {lead.nomeDaClinica} · {lead.origem}
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
            {lead.etapa}
          </span>
        </div>
      </Link>
    </li>
  );
}
