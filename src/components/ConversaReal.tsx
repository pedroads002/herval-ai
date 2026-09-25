"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Image as ImagemIcone,
  Mic,
  Paperclip,
  Send,
  StickyNote,
  Video,
  X,
} from "lucide-react";
import {
  ehDoLead,
  ehMidia,
  formatosDeMidia,
  textoVisivel,
  type FormatoDeMidia,
} from "@/data/mensagens";
import { useLeads } from "@/components/ProvedorLeads";
import {
  abasDoAtendimento,
  AbaAgenda,
  AbaLigacoes,
  type AbaDoAtendimento,
} from "@/components/AbasDoAtendimento";
import { clinicaPorId } from "@/data/clinicas";
import { ligacoesDoLead } from "@/data/ligacoes";
import { tempoRelativo } from "@/lib/tempo";
import type {
  ClinicaDoLead,
  LeadEmAtendimento,
  MensagemEmAtendimento,
  NotaEmAtendimento,
} from "@/lib/dados/atendimento";

/** O ícone que acompanha a bolha quando a mensagem chegou sem texto. */
const iconeDoFormato: Record<FormatoDeMidia, typeof Mic> = {
  audio: Mic,
  imagem: ImagemIcone,
  video: Video,
};

/**
 * O mesmo limite que a rota aplica no servidor.
 *
 * Aqui ele evita a viagem: subir 4 MB para receber "grande demais" gasta o
 * tempo do CRC e a internet da clínica. Lá ele impede que alguém contorne
 * esta checagem. As duas existem por motivos diferentes.
 */
const LIMITE_DO_ARQUIVO = 3 * 1024 * 1024;

/** Só o que a Evolution sabe mandar e a conversa sabe mostrar. */
const ACEITOS = "image/*,audio/*,video/*";

/**
 * De que formato é este arquivo, pelo tipo que o navegador informou.
 *
 * Nulo quando não é nenhum dos três — documento, planilha, o que for. O
 * `accept` do seletor já filtra, mas ele é só uma sugestão: dá para arrastar
 * qualquer coisa para dentro, e o navegador aceita.
 */
function formatoDoArquivo(arquivo: File): FormatoDeMidia | null {
  if (arquivo.type.startsWith("image/")) return "imagem";
  if (arquivo.type.startsWith("audio/")) return "audio";
  if (arquivo.type.startsWith("video/")) return "video";
  return null;
}

/** O arquivo como base64 puro, sem o prefixo `data:` que o leitor acrescenta. */
function lerComoBase64(arquivo: File) {
  return new Promise<string>((resolver, recusar) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const texto = String(leitor.result ?? "");
      const virgula = texto.indexOf(",");
      resolver(virgula >= 0 ? texto.slice(virgula + 1) : texto);
    };
    leitor.onerror = () => recusar(new Error("Não deu para ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * A conversa de um lead, lida do banco.
 *
 * Substituiu a tela antiga de atendimento, que dependia de ligação,
 * agendamento, régua e score — nenhum deles existe no banco. Aproveitá-la
 * obrigaria a inventar esses campos, e um score plausível ao lado de uma
 * conversa real é pior que nenhum score: o CRC não teria como saber qual
 * metade acreditar. Ela foi removida junto com esta mudança; o Git guarda,
 * caso Ligações e Agenda voltem a ter dado de verdade.
 *
 * A coluna da conversa, as notas e o histórico leem o banco. As abas Agenda e
 * Ligações ficam exatamente como eram, com os dados de exemplo e a mesma
 * aparência — foi o que a operação pediu, para a tela não mudar de cara na
 * semana da estreia. Elas não funcionam de verdade: marcar uma consulta ou
 * registrar uma ligação ali não sai do navegador.
 */
export default function ConversaReal({
  lead,
  mensagens,
  notas: notasIniciais,
  clinica,
  falha,
  envioConfigurado,
}: {
  lead: LeadEmAtendimento | null;
  mensagens: MensagemEmAtendimento[];
  notas: NotaEmAtendimento[];
  clinica: ClinicaDoLead | null;
  falha: string | null;
  /**
   * Se este ambiente sabe enviar. Vem do servidor porque depende de variáveis
   * que o navegador não pode ler — e sem isso o botão prometeria um envio que
   * falharia só depois do clique.
   */
  envioConfigurado: boolean;
}) {
  /**
   * As abas Agenda e Ligações seguem no provedor de exemplo, que é de onde
   * elas sempre vieram. Nada aqui grava no banco: `definirConsulta` mexe só no
   * estado do navegador, como já fazia.
   */
  const { agendamentos, ligacoes, definirConsulta } = useLeads();

  const [conversa, setConversa] = useState(mensagens);
  const [notas, setNotas] = useState(notasIniciais);

  /**
   * A tela se recarrega sozinha a cada poucos segundos, e o que vem do servidor
   * manda. Sem isto, a atualização automática traria dado novo e a conversa
   * continuaria mostrando o estado do primeiro carregamento — o defeito exato
   * que a atualização veio resolver.
   *
   * É o ajuste de estado durante a renderização, e não um efeito: assim a tela
   * nunca chega a desenhar uma vez com o dado velho.
   *
   * A mensagem que acabou de ser enviada não pisca: ela só entra na lista
   * depois que o n8n confirma que gravou, então já está no banco quando a
   * próxima leitura acontece.
   */
  const [ultimaLeitura, setUltimaLeitura] = useState(mensagens);
  if (mensagens !== ultimaLeitura) {
    setUltimaLeitura(mensagens);
    setConversa(mensagens);
    setNotas(notasIniciais);
  }
  const [aba, setAba] = useState<AbaDoAtendimento>("Agenda");
  const [agendamentoAberto, setAgendamentoAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoDaNota, setAvisoDaNota] = useState<string | null>(null);

  /**
   * A linha do tempo não tem tabela própria, de propósito: ela é derivada do
   * que já está gravado — a chegada do lead, cada fala e cada nota. Copiar
   * isso para um registro separado criaria duas versões do mesmo fato, livres
   * para discordarem.
   *
   * Mudança de etapa ainda não entra aqui porque nada no painel muda etapa de
   * verdade. A tabela já existe e passa a alimentar esta lista sozinha no dia
   * em que isso mudar.
   */
  const linhaDoTempo = useMemo(() => {
    if (!lead) return [];

    const eventos = [
      {
        chave: "chegada",
        minutosAtras: lead.minutosAtras,
        titulo: "Lead chegou",
        detalhe: lead.origem,
      },
      ...conversa.map((m) => ({
        chave: `m${m.id}`,
        minutosAtras: m.minutosAtras,
        titulo: ehDoLead(m)
          ? "Mensagem do lead"
          : `Resposta · ${m.remetente.nome ?? m.remetente.tipo}`,
        detalhe: textoVisivel(m),
      })),
      ...notas.map((n) => ({
        chave: `n${n.id}`,
        minutosAtras: n.minutosAtras,
        titulo: `Nota · ${n.autor}`,
        detalhe: n.texto,
      })),
    ];

    // Do mais recente para o mais antigo: quem abre a tela quer saber o que
    // acabou de acontecer, não como começou.
    return eventos.sort((a, b) => a.minutosAtras - b.minutosAtras);
  }, [lead, conversa, notas]);

  /**
   * Agenda e Ligações continuam lendo a base de exemplo, pelo id do lead. Um
   * lead real cujo id não exista lá simplesmente aparece sem consulta e sem
   * ligação — que é o estado verdadeiro dele, já que nada disso foi migrado.
   */
  const consultas = useMemo(
    () => (lead ? agendamentos.filter((a) => a.leadId === lead.id) : []),
    [agendamentos, lead],
  );
  const chamadas = useMemo(
    () => (lead ? ligacoesDoLead(ligacoes, lead.id) : []),
    [ligacoes, lead],
  );

  /**
   * Abrir a conversa no fim, e não no começo.
   *
   * A mensagem que importa é a última, e a lista cresce para baixo. Sem isto,
   * um lead com vinte e três mensagens abriria no "Oi" de dois dias atrás e o
   * CRC teria que rolar até embaixo toda vez — inclusive a cada atualização
   * automática, de dez em dez segundos.
   */
  const areaDaConversa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const area = areaDaConversa.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [conversa]);

  if (falha) {
    return (
      <Recado
        titulo="Não deu para carregar esta conversa."
        texto={falha}
        tom="erro"
      />
    );
  }

  /**
   * Id que não existe no banco. O caso mais provável é ter chegado por um card
   * do Funil, que ainda usa dado de exemplo — por isso o texto explica a
   * situação em vez de dizer que o lead não existe, o que soaria como defeito.
   */
  if (!lead) {
    return (
      <Recado
        titulo="Este lead não está no banco de dados."
        texto="A tela de Atendimento mostra as conversas reais. Os cards do Funil ainda vêm de dados de exemplo, e não têm conversa para abrir."
        tom="neutro"
      />
    );
  }

  async function enviar() {
    if (!lead) return;
    const conteudo = texto.trim();
    // Com arquivo, o texto é legenda e pode ser vazio: mandar uma foto sem
    // dizer nada é normal numa conversa.
    if (conteudo === "" && !arquivo) return;

    setEnviando(true);
    setAviso(null);

    try {
      let midia: { tipo: FormatoDeMidia; base64: string } | null = null;
      if (arquivo) {
        const tipo = formatoDoArquivo(arquivo);
        if (!tipo) {
          setAviso("Só dá para enviar imagem, áudio ou vídeo por aqui.");
          return;
        }
        if (arquivo.size > LIMITE_DO_ARQUIVO) {
          setAviso(
            `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite é ${LIMITE_DO_ARQUIVO / 1024 / 1024} MB.`,
          );
          return;
        }
        midia = { tipo, base64: await lerComoBase64(arquivo) };
      }

      const resposta = await fetch("/api/crc/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          // O telefone cru, como está gravado: a conferência do lado do n8n
          // compara só dígitos, e o formatado perde o código do país.
          telefone: lead.telefoneBruto,
          texto: conteudo,
          ...(midia ? { midia } : {}),
        }),
      });
      const resultado = (await resposta.json().catch(() => null)) as {
        enviada?: boolean;
        motivo?: string;
        autor?: string;
      } | null;

      if (!resultado?.enviada) {
        setAviso(resultado?.motivo ?? "A mensagem não foi enviada.");
        return;
      }

      // Só entra na conversa depois de confirmado. Mostrar antes faria a tela
      // afirmar que o lead recebeu algo que talvez não tenha saído.
      setConversa((atuais) => [
        ...atuais,
        {
          id: Date.now(),
          leadId: lead.id,
          remetente: { tipo: "Humano", nome: resultado.autor },
          formato: midia ? midia.tipo : "texto",
          minutosAtras: 0,
          texto: conteudo,
          status: "enviada",
        },
      ]);
      setTexto("");
      setArquivo(null);
    } catch {
      setAviso(
        "Não deu para falar com o servidor. Confira no WhatsApp antes de reenviar.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function salvarNota() {
    if (!lead) return;
    const conteudo = nota.trim();
    if (conteudo === "") return;

    setSalvandoNota(true);
    setAvisoDaNota(null);

    try {
      const resposta = await fetch("/api/crc/nota", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // O autor não vai daqui: quem assina é o servidor, pela sessão.
        body: JSON.stringify({ leadId: lead.id, texto: conteudo }),
      });
      const resultado = (await resposta.json().catch(() => null)) as {
        salva?: boolean;
        motivo?: string;
        nota?: NotaEmAtendimento;
      } | null;

      if (!resultado?.salva || !resultado.nota) {
        setAvisoDaNota(resultado?.motivo ?? "A nota não foi salva.");
        return;
      }

      setNotas((atuais) => [resultado.nota as NotaEmAtendimento, ...atuais]);
      setNota("");
    } catch {
      setAvisoDaNota("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setSalvandoNota(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
        <Link
          href="/atendimento"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Atendimento
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-herval-preto">
              {lead.lead}
            </h1>
            <p className="mt-1 text-sm font-medium text-black/55">
              {lead.telefone} · {lead.nomeDaClinica} · {lead.origem}
            </p>
          </div>

          <span className="rounded-full bg-herval-verde/15 px-3 py-1.5 text-xs font-bold text-herval-preto">
            {lead.etapa}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)_18rem]">
        {/* Coluna esquerda: dados e notas */}
        <div className="space-y-5">
          <section className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-black/45">
              Dados do lead
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Dado rotulo="Telefone" valor={lead.telefone} />
              <Dado
                rotulo="Clínica"
                valor={
                  clinica
                    ? `${clinica.nome}${clinica.cidade ? ` · ${clinica.cidade}` : ""}`
                    : lead.nomeDaClinica
                }
              />
              <Dado rotulo="Origem" valor={lead.origem} />
              <Dado rotulo="Chegou" valor={tempoRelativo(lead.minutosAtras)} />
            </dl>
            <p className="mt-3 rounded-controle bg-black/[0.04] px-3 py-2 text-xs text-black/60">
              Score, régua de ligação e prazo não aparecem aqui porque ainda não
              existem no banco.
            </p>
          </section>

          <section className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
              <StickyNote className="h-3.5 w-3.5" />
              Notas internas ({notas.length})
            </h2>

            {notas.length === 0 ? (
              <p className="mt-3 text-sm font-medium text-black/55">
                Nenhuma nota ainda.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {notas.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-controle border border-black/10 p-3"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-bold text-black/50">
                      <span className="max-w-[11rem] truncate text-herval-preto">
                        {item.autor}
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

            {avisoDaNota && (
              <p className="mt-2 rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto">
                {avisoDaNota}
              </p>
            )}

            <button
              type="button"
              disabled={nota.trim() === "" || salvandoNota}
              onClick={salvarNota}
              className="mt-2 w-full rounded-full bg-herval-verde px-4 py-2 text-xs font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
            >
              {salvandoNota ? "Salvando…" : "Salvar nota"}
            </button>
          </section>
        </div>

        {/*
          Coluna central: a conversa.

          A altura é fixa de propósito. Enquanto era só `min-h`, o bloco crescia
          junto com a conversa e a página inteira ia junto: num lead com vinte e
          três mensagens, o CRC precisava rolar a página toda para achar a caixa
          de resposta, que ficava lá embaixo. Com altura definida, quem rola é a
          lista de mensagens, e cabeçalho e caixa de envio ficam sempre à vista —
          como em qualquer aplicativo de mensagem.

          O `min-h` continua como piso para telas baixas, onde `100vh` menos o
          cabeçalho sobraria pouco demais para ler qualquer coisa.
        */}
        <section className="flex h-[calc(100vh-15rem)] min-h-[26rem] flex-col rounded-card border border-black/10 bg-herval-branco shadow-card">
          <h2 className="shrink-0 border-b border-black/10 px-5 py-4 text-[11px] font-bold uppercase tracking-wide text-black/45">
            Conversa
          </h2>

          <div ref={areaDaConversa} className="flex-1 space-y-4 overflow-y-auto p-5">
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
                            ? lead.lead.split(" ")[0]
                            : (mensagem.remetente.nome ??
                              mensagem.remetente.tipo)}
                        </span>
                        <span className="text-[11px] font-medium text-black/40">
                          {tempoRelativo(mensagem.minutosAtras)}
                        </span>
                        {ehMidia(mensagem.formato) && (
                          <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-bold text-black/50">
                            {formatosDeMidia[mensagem.formato].curto}
                          </span>
                        )}
                      </div>

                      <p
                        className={[
                          "mt-1 flex items-center gap-2 rounded-controle px-3.5 py-2.5 text-sm leading-relaxed",
                          doLead
                            ? "bg-black/[0.05] text-black/75"
                            : "bg-herval-verde/15 text-herval-preto",
                          // Sem texto, a bolha vira um rótulo do que chegou.
                          mensagem.texto.trim() === ""
                            ? "italic text-black/55"
                            : "",
                        ].join(" ")}
                      >
                        {mensagem.texto.trim() === "" &&
                          ehMidia(mensagem.formato) &&
                          (() => {
                            const Icone = iconeDoFormato[mensagem.formato];
                            return <Icone className="h-4 w-4 shrink-0" />;
                          })()}
                        {textoVisivel(mensagem)}
                      </p>

                      {ehMidia(mensagem.formato) && (
                        <Midia
                          mensagemId={mensagem.id}
                          leadId={lead.id}
                          formato={mensagem.formato}
                          doLead={doLead}
                        />
                      )}

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

          {aviso && (
            <p className="mx-4 rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto">
              {aviso}
            </p>
          )}

          {!envioConfigurado && (
            <p className="mx-4 mt-2 rounded-controle bg-black/[0.05] px-3 py-2 text-xs font-medium text-black/65">
              O envio ainda não está ligado neste ambiente. Dá para ler a
              conversa e escrever notas, mas não responder ao lead por aqui.
            </p>
          )}

          <div className="shrink-0 border-t border-black/10 p-4">
            {/* O arquivo escolhido, antes de sair. Dá para desistir. */}
            {arquivo && (
              <div className="mb-2 flex items-center gap-2 rounded-controle bg-herval-verde/10 px-3 py-2">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-black/50" />
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-herval-preto">
                  {arquivo.name}
                </span>
                <span className="shrink-0 text-[11px] font-medium text-black/45">
                  {(arquivo.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => setArquivo(null)}
                  aria-label="Tirar o arquivo"
                  className="shrink-0 rounded-full p-0.5 text-black/40 transition-colors hover:bg-black/10 hover:text-herval-preto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <label
                className={[
                  "inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-controle border border-black/15 text-black/50 transition-colors hover:border-herval-verde hover:text-herval-preto",
                  !envioConfigurado || enviando
                    ? "pointer-events-none opacity-40"
                    : "",
                ].join(" ")}
                title="Anexar imagem, áudio ou vídeo"
              >
                <Paperclip className="h-4 w-4" />
                <input
                  type="file"
                  accept={ACEITOS}
                  disabled={!envioConfigurado || enviando}
                  onChange={(e) => {
                    setArquivo(e.target.files?.[0] ?? null);
                    setAviso(null);
                    // Limpa o campo para dar para escolher o mesmo arquivo de
                    // novo depois de removê-lo — sem isso o `change` não
                    // dispara na segunda vez.
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>

              <textarea
                rows={2}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={!envioConfigurado}
                placeholder={
                  envioConfigurado
                    ? arquivo
                      ? "Legenda do arquivo (opcional)"
                      : "Assumir a conversa e responder como CRC"
                    : "Envio indisponível neste ambiente"
                }
                className="flex-1 resize-none rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25 disabled:cursor-not-allowed disabled:bg-black/[0.03]"
              />

              <button
                type="button"
                disabled={
                  (texto.trim() === "" && !arquivo) ||
                  enviando ||
                  !envioConfigurado
                }
                onClick={enviar}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-herval-verde px-5 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
              >
                <Send className="h-4 w-4" />
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </section>

        {/* Coluna direita: as quatro abas */}
        <div className="space-y-5">
          {/*
            As quatro abas, iguais às de antes. Agenda e Ligações seguem com os
            dados de exemplo e a mesma aparência; Clínica e Histórico leem o
            banco.
          */}
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
                  clinica={
                    lead.clinicaId === null
                      ? undefined
                      : clinicaPorId(lead.clinicaId)
                  }
                  agendamentos={consultas}
                  aberto={agendamentoAberto}
                  aoAlternar={setAgendamentoAberto}
                  aoAgendar={(dados) => definirConsulta(lead.id, dados)}
                />
              )}
              {aba === "Ligações" && <AbaLigacoes ligacoes={chamadas} />}
              {aba === "Clínica" && (
                <FichaDaClinica clinica={clinica} nome={lead.nomeDaClinica} />
              )}
              {aba === "Log" && <Historico eventos={linhaDoTempo} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * O arquivo de uma mensagem de mídia, dentro da bolha.
 *
 * A fonte é sempre a nossa rota, nunca a URL que o WhatsApp mandou: aquelas
 * vêm criptografadas e só a Evolution sabe abrir. A rota busca na hora e
 * devolve os bytes.
 *
 * Quando a mídia não está disponível — Evolution já apagou, ou a mensagem é
 * anterior a este recurso e não tem id guardado — o elemento falha e some, e a
 * bolha fica com o rótulo que já existia ("Áudio enviado"). É degradação
 * silenciosa de propósito: mídia antiga sumir é o esperado, não um defeito
 * para alarmar o CRC no meio de um atendimento.
 */
function Midia({
  mensagemId,
  leadId,
  formato,
  doLead,
}: {
  mensagemId: number;
  leadId: number;
  formato: FormatoDeMidia;
  doLead: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) return null;

  const fonte = `/api/crc/midia?mensagemId=${mensagemId}&leadId=${leadId}`;
  const alinhamento = doLead ? "" : "ml-auto";

  if (formato === "imagem") {
    return (
      // A imagem é do WhatsApp e não tem dimensão conhecida antes de chegar;
      // `next/image` exigiria width e height, e chutá-los distorceria a foto.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fonte}
        alt="Imagem enviada na conversa"
        onError={() => setFalhou(true)}
        className={`mt-1.5 max-h-72 rounded-controle border border-black/10 object-contain ${alinhamento}`}
      />
    );
  }

  if (formato === "video") {
    return (
      <video
        src={fonte}
        controls
        preload="metadata"
        onError={() => setFalhou(true)}
        className={`mt-1.5 max-h-72 w-full rounded-controle border border-black/10 ${alinhamento}`}
      />
    );
  }

  return (
    <audio
      src={fonte}
      controls
      preload="metadata"
      onError={() => setFalhou(true)}
      className={`mt-1.5 w-full max-w-[17rem] ${alinhamento}`}
    />
  );
}

/**
 * A ficha da clínica, lida do banco.
 *
 * Não reaproveita a `AbaClinica` original porque aquela recebe a clínica da
 * base de exemplo, com campos que a tabela `clinicas` não tem. O conteúdo aqui
 * é o que existe de verdade.
 */
function FichaDaClinica({
  clinica,
  nome,
}: {
  clinica: ClinicaDoLead | null;
  nome: string;
}) {
  if (!clinica) {
    return (
      <p className="text-sm font-medium text-black/55">
        A clínica deste lead ({nome}) não está no cadastro.
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-sm font-extrabold text-herval-preto">
        {clinica.nome}
        {clinica.cidade ? (
          <span className="font-medium text-black/50"> · {clinica.cidade}</span>
        ) : null}
      </p>
      <dl className="space-y-2.5">
        <Dado rotulo="Endereço" valor={clinica.endereco} />
        <Dado rotulo="Horário" valor={clinica.horarioFuncionamento} />
        <Dado rotulo="Pagamento" valor={clinica.formasPagamento} />
        <Dado rotulo="Parcelamento" valor={clinica.parcelamento} />
        <Dado rotulo="Convênios" valor={clinica.convenios} />
      </dl>
    </div>
  );
}

/** A linha do tempo derivada: chegada do lead, falas e notas. */
function Historico({
  eventos,
}: {
  eventos: {
    chave: string;
    minutosAtras: number;
    titulo: string;
    detalhe: string;
  }[];
}) {
  return (
    <div>
      <ul className="space-y-3">
        {eventos.map((evento) => (
          <li key={evento.chave} className="border-l-2 border-black/10 pl-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-bold text-herval-preto">
                {evento.titulo}
              </p>
              <span className="shrink-0 text-[11px] font-medium text-black/40">
                {tempoRelativo(evento.minutosAtras)}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-black/60">
              {evento.detalhe}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-controle bg-black/[0.04] px-3 py-2 text-xs text-black/60">
        Mudança de etapa ainda não entra aqui: nada no painel muda a etapa de
        verdade por enquanto.
      </p>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-xs font-bold text-black/45">{rotulo}</dt>
      <dd className="min-w-0 flex-1 text-sm text-black/70">
        {valor?.trim() ? valor : "—"}
      </dd>
    </div>
  );
}

function Recado({
  titulo,
  texto,
  tom,
}: {
  titulo: string;
  texto: string;
  tom: "erro" | "neutro";
}) {
  return (
    <div
      className={[
        "rounded-card border bg-herval-branco p-8 shadow-card",
        tom === "erro" ? "border-herval-vermelho/30" : "border-black/10",
      ].join(" ")}
    >
      <h2 className="text-lg font-extrabold tracking-tight text-herval-preto">
        {titulo}
      </h2>
      <p className="mt-2 max-w-xl text-sm font-medium text-black/60">{texto}</p>
      <Link
        href="/atendimento"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-5 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para o Atendimento
      </Link>
    </div>
  );
}
