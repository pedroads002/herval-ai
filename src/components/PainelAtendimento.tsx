"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Move,
  Phone,
  Send,
  StickyNote,
} from "lucide-react";
import { useLeads } from "@/components/ProvedorLeads";
import MenuDeEtapa, { type PassoDoMenu } from "@/components/MenuDeEtapa";
import {
  abasDoAtendimento,
  AbaAgenda,
  AbaClinica,
  AbaLigacoes,
  AbaLog,
  type AbaDoAtendimento,
} from "@/components/AbasDoAtendimento";
import { clinicaPorId } from "@/data/clinicas";
import { conversaDoLead, ehDoLead } from "@/data/mensagens";
import { ligacoesDoLead, type CanalDeLigacao } from "@/data/ligacoes";
import { notasDoLead } from "@/data/notas";
import { mudancasDoLead } from "@/data/historicoEtapas";
import { tempoRelativo } from "@/lib/tempo";

const canais: { canal: CanalDeLigacao; rotulo: string }[] = [
  { canal: "discador", rotulo: "Discador" },
  { canal: "whatsapp", rotulo: "WhatsApp" },
];

export default function PainelAtendimento({ leadId }: { leadId: number }) {
  const {
    tarefas,
    agendamentos,
    historicoDeEtapas,
    mensagens,
    ligacoes,
    notas,
    moverEtapa,
    definirConsulta,
    enviarMensagem,
    registrarLigacao,
    adicionarNota,
  } = useLeads();

  const [passo, setPasso] = useState<PassoDoMenu>("etapa");
  const [menuAberto, setMenuAberto] = useState(false);
  const [ligarAberto, setLigarAberto] = useState(false);
  const [aba, setAba] = useState<AbaDoAtendimento>("Agenda");
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");

  const tarefa = tarefas.find((t) => t.id === leadId);

  const conversa = useMemo(
    () => (tarefa ? conversaDoLead(mensagens, tarefa.id) : []),
    [mensagens, tarefa],
  );
  const chamadas = useMemo(
    () => (tarefa ? ligacoesDoLead(ligacoes, tarefa.id) : []),
    [ligacoes, tarefa],
  );
  const anotacoes = useMemo(
    () => (tarefa ? notasDoLead(notas, tarefa.id) : []),
    [notas, tarefa],
  );
  const mudancas = useMemo(
    () => (tarefa ? mudancasDoLead(historicoDeEtapas, tarefa.id) : []),
    [historicoDeEtapas, tarefa],
  );
  const consultas = useMemo(
    () => (tarefa ? agendamentos.filter((a) => a.leadId === tarefa.id) : []),
    [agendamentos, tarefa],
  );

  /**
   * Só os leads da fila têm atendimento. Os históricos existem para alimentar
   * relatório: não têm nome, telefone nem conversa, e abrir um deles aqui seria
   * uma tela vazia fingindo ser um atendimento.
   */
  if (!tarefa) {
    return (
      <div className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
        <h2 className="text-lg font-extrabold tracking-tight text-herval-preto">
          Este lead não está na fila de atendimento
        </h2>
        <p className="mt-2 max-w-xl text-sm font-medium text-black/60">
          O atendimento existe para os leads que a equipe trabalha hoje. Leads
          antigos ficam só nos relatórios, sem conversa nem contato para abrir.
        </p>
        <Link
          href="/funil"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-5 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o Funil
        </Link>
      </div>
    );
  }

  const clinica = clinicaPorId(tarefa.clinicaId);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
        <Link
          href="/funil"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Funil
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-herval-preto">
              {tarefa.lead}
            </h1>
            <p className="mt-1 text-sm font-medium text-black/55">
              {tarefa.telefone} · {clinica?.nome ?? "Clínica removida"} ·{" "}
              {tarefa.origem}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-herval-verde/15 px-3 py-1.5 text-xs font-bold text-herval-preto">
              {tarefa.etapa}
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setLigarAberto((a) => !a);
                  setMenuAberto(false);
                }}
                aria-expanded={ligarAberto}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-bold text-black/70 transition-colors hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto"
              >
                <Phone className="h-3.5 w-3.5" />
                Ligar
              </button>

              {ligarAberto && (
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-controle border border-black/10 bg-herval-branco p-3 shadow-card">
                  <p className="pb-2 text-[11px] font-bold uppercase tracking-wide text-black/45">
                    Registrar tentativa
                  </p>
                  <div className="space-y-2">
                    {canais.map(({ canal, rotulo }) => (
                      <div key={canal} className="flex items-center gap-2">
                        <span className="flex-1 text-xs font-bold text-herval-preto">
                          {rotulo}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            registrarLigacao(tarefa.id, canal, "atendida");
                            setLigarAberto(false);
                            setAba("Ligações");
                          }}
                          className="rounded-full bg-herval-verde px-2.5 py-1 text-[11px] font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
                        >
                          atendeu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            registrarLigacao(tarefa.id, canal, "não atendida");
                            setLigarAberto(false);
                            setAba("Ligações");
                          }}
                          className="rounded-full border border-black/20 px-2.5 py-1 text-[11px] font-bold text-black/60 transition-colors hover:text-herval-preto"
                        >
                          não atendeu
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] font-medium leading-snug text-black/45">
                    A ligação é sempre do CRC: quem escolhe o canal e registra o
                    desfecho é você.
                  </p>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setMenuAberto((a) => !a);
                  setPasso("etapa");
                  setLigarAberto(false);
                }}
                aria-expanded={menuAberto}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                  menuAberto
                    ? "bg-herval-preto text-herval-branco"
                    : "border border-black/15 text-black/70 hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto",
                ].join(" ")}
              >
                <Move className="h-3.5 w-3.5" />
                Mover etapa
              </button>

              {menuAberto && (
                <div className="absolute right-0 z-10 mt-2 w-72 rounded-controle border border-black/10 bg-herval-branco p-3 shadow-card">
                  <MenuDeEtapa
                    etapaAtual={tarefa.etapa}
                    passo={passo}
                    aoPedirPasso={setPasso}
                    aoMover={(etapa, dados) => {
                      moverEtapa(tarefa.id, etapa, dados);
                      setMenuAberto(false);
                      setPasso("etapa");
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,22rem)]">
        {/* Coluna esquerda: dados e notas internas */}
        <div className="space-y-5">
          <section className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-black/45">
              Dados do lead
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Dado rotulo="Telefone" valor={tarefa.telefone} />
              <Dado
                rotulo="Clínica"
                valor={`${clinica?.nome ?? "—"} · ${clinica?.cidade ?? "—"}`}
              />
              <Dado rotulo="Origem" valor={tarefa.origem} />
              <Dado
                rotulo="Chegou"
                valor={tempoRelativo(tarefa.diasAtras * 1440)}
              />
              <Dado
                rotulo="Score"
                valor={`${tarefa.score.percentual}% · ${tarefa.score.nivel}`}
              />
            </dl>
            <p className="mt-3 rounded-controle bg-black/[0.04] px-3 py-2 text-xs text-black/65">
              {tarefa.score.motivo}
            </p>
          </section>

          <section className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
              <StickyNote className="h-3.5 w-3.5" />
              Notas internas ({anotacoes.length})
            </h2>

            {anotacoes.length === 0 ? (
              <p className="mt-3 text-sm font-medium text-black/55">
                Nenhuma nota ainda.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {anotacoes.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-controle border border-black/10 p-3"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-bold text-black/50">
                      <span className="max-w-[11rem] truncate text-herval-preto">
                        {item.autor.nome ?? "CRC"}
                      </span>
                      <span>{tempoRelativo(item.minutosAtras)}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-black/70">
                      {item.texto}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <textarea
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Escrever uma nota. O lead nunca vê isto."
              className="mt-3 w-full rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25"
            />
            <button
              type="button"
              disabled={nota.trim() === ""}
              onClick={() => {
                adicionarNota(tarefa.id, nota);
                setNota("");
              }}
              className="mt-2 w-full rounded-full bg-herval-verde px-4 py-2 text-xs font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
            >
              Salvar nota
            </button>
          </section>
        </div>

        {/* Coluna central: a conversa */}
        <section className="flex min-h-[32rem] flex-col rounded-card border border-black/10 bg-herval-branco shadow-card">
          <h2 className="border-b border-black/10 px-5 py-4 text-[11px] font-bold uppercase tracking-wide text-black/45">
            Conversa
          </h2>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {conversa.length === 0 ? (
              <p className="text-sm font-medium text-black/55">
                Ainda não houve nenhuma mensagem com este lead.
              </p>
            ) : (
              conversa.map((mensagem) => {
                const doLead = ehDoLead(mensagem);
                return (
                  <div
                    key={mensagem.id}
                    className={doLead ? "flex" : "flex justify-end"}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className={[
                          "flex flex-wrap items-center gap-2",
                          doLead ? "" : "justify-end",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "max-w-[13rem] truncate text-[11px] font-bold tracking-wide text-black/45",
                            // O nome de quem responde vem do login e pode ser
                            // um e-mail, enquanto o perfil não tem nome
                            // preenchido: em caixa alta isso fica ilegível.
                            doLead ? "uppercase" : "",
                          ].join(" ")}
                        >
                          {doLead
                            ? tarefa.lead.split(" ")[0]
                            : (mensagem.remetente.nome ??
                              mensagem.remetente.tipo)}
                        </span>
                        <span className="text-[11px] font-medium text-black/40">
                          {tempoRelativo(mensagem.minutosAtras)}
                        </span>
                        {mensagem.formato === "audio" && (
                          <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-bold text-black/50">
                            áudio
                          </span>
                        )}
                      </div>

                      <p
                        className={[
                          "mt-1 rounded-controle px-3.5 py-2.5 text-sm leading-relaxed",
                          doLead
                            ? "bg-black/[0.05] text-black/75"
                            : "bg-herval-verde/15 text-herval-preto",
                        ].join(" ")}
                      >
                        {mensagem.texto}
                      </p>

                      {mensagem.regra && (
                        <p className="mt-1 text-right text-[11px] font-medium text-black/40">
                          {mensagem.regra}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-end gap-2 border-t border-black/10 p-4">
            <textarea
              rows={2}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Assumir a conversa e responder como CRC"
              className="flex-1 resize-none rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25"
            />
            <button
              type="button"
              disabled={texto.trim() === ""}
              onClick={() => {
                enviarMensagem(tarefa.id, texto);
                setTexto("");
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-4 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </section>

        {/* Coluna direita: as quatro abas */}
        <section className="rounded-card border border-black/10 bg-herval-branco shadow-card">
          <div className="flex gap-1 border-b border-black/10 px-3 pt-3">
            {abasDoAtendimento.map((opcao) => {
              const ativa = opcao === aba;
              return (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setAba(opcao)}
                  aria-current={ativa}
                  className={[
                    "rounded-t-controle px-3 py-2 text-xs font-bold transition-colors",
                    ativa
                      ? "bg-herval-verde/15 text-herval-preto"
                      : "text-black/50 hover:text-herval-preto",
                  ].join(" ")}
                >
                  {opcao}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {aba === "Agenda" && (
              <AbaAgenda
                clinica={clinica}
                agendamentos={consultas}
                aoAgendar={(dados) => definirConsulta(tarefa.id, dados)}
              />
            )}
            {aba === "Ligações" && <AbaLigacoes ligacoes={chamadas} />}
            {aba === "Clínica" && <AbaClinica clinica={clinica} />}
            {aba === "Log" && <AbaLog mudancas={mudancas} />}
          </div>
        </section>
      </div>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs font-medium text-black/50">{rotulo}</dt>
      <dd className="text-right text-xs font-bold text-herval-preto">{valor}</dd>
    </div>
  );
}
