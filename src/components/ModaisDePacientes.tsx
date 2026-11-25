"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  buscarDuplicados,
  editarPaciente,
  excluirPacientes,
  importarPacientes,
  moverPacientesDeEtapa,
} from "@/lib/acoes/pacientes";
import {
  ETAPAS_DA_REGUA,
  formatarDataCurta,
  formatarTelefone,
  lerPlanilha,
  normalizarTelefone,
  TETO_DA_IMPORTACAO,
  type GrupoDeDuplicados,
  type OpcaoSimples,
  type PacienteDaLista,
  type PreviaDaImportacao,
} from "@/lib/dados/linhaDePaciente";
import {
  ETAPA_GANHA,
  ETAPA_PERDIDA,
  etapasFunil,
  motivosDePerda,
} from "@/data/leads";
import { apoioDoMotivo } from "@/components/MenuDeEtapa";

/**
 * Os modais da tela de Pacientes. Cada um grava pela ação de servidor da
 * própria tarefa (`acoes/pacientes.ts`) e devolve a mensagem para a tela, que
 * relê a página — nenhum deles mexe na lista por conta própria, para a tela
 * nunca mostrar algo que o banco não confirmou.
 */

const campo =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const botaoPrincipal =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-herval-verde px-4 py-2.5 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:opacity-50";

const botaoPerigo =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-herval-vermelho px-4 py-2.5 text-sm font-extrabold text-herval-branco transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const botaoSecundario =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-black/15 px-4 py-2.5 text-sm font-bold text-black/65 transition-colors hover:border-herval-verde hover:text-herval-preto disabled:opacity-50";

export type AoTerminar = (mensagem: string, ok: boolean) => void;

// ---------------------------------------------------------------------------
// Moldura
// ---------------------------------------------------------------------------

export function Moldura({
  titulo,
  subtitulo,
  icone,
  largura = "max-w-md",
  aoFechar,
  children,
  rodape,
}: {
  titulo: string;
  subtitulo?: string;
  icone?: ReactNode;
  largura?: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const botaoFecharRef = useRef<HTMLButtonElement>(null);
  // Por referência: se o efeito dependesse da função, cada nova renderização
  // da tela devolveria o foco ao botão de fechar, no meio da digitação.
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    botaoFecharRef.current?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") aoFecharRef.current();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex max-h-[90vh] w-full ${largura} flex-col rounded-card border border-black/10 bg-herval-branco shadow-card`}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-herval-preto">
              {icone}
              {titulo}
            </h2>
            {subtitulo && (
              <p className="mt-1 truncate text-xs font-medium text-black/55">
                {subtitulo}
              </p>
            )}
          </div>
          <button
            ref={botaoFecharRef}
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-full p-1 text-black/45 transition-colors hover:bg-black/5 hover:text-herval-preto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 px-5 py-4">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p
      role="alert"
      className="mt-3 rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-bold text-herval-vermelho"
    >
      {texto}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Editar informações
// ---------------------------------------------------------------------------

export function ModalEditar({
  paciente,
  procedimentos,
  aoFechar,
  aoTerminar,
}: {
  paciente: PacienteDaLista;
  procedimentos: OpcaoSimples[];
  aoFechar: () => void;
  aoTerminar: AoTerminar;
}) {
  const [nome, setNome] = useState(paciente.nome);
  const [telefone, setTelefone] = useState(formatarTelefone(paciente.telefone));
  const [especialidade, setEspecialidade] = useState<string>(
    paciente.especialidadeId === null ? "" : String(paciente.especialidadeId),
  );
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O aviso só aparece quando o número muda de verdade, não quando a pessoa
  // só reescreve o mesmo número com outra pontuação.
  const telefoneMudou =
    normalizarTelefone(telefone) !== null &&
    normalizarTelefone(telefone) !== paciente.telefone;

  // O procedimento salvo pode estar pausado e fora da lista de ativos. Ele
  // continua aparecendo, para salvar o formulário não apagar o que havia.
  const opcoes =
    paciente.especialidadeId !== null &&
    !procedimentos.some((p) => p.id === paciente.especialidadeId)
      ? [
          ...procedimentos,
          { id: paciente.especialidadeId, nome: "Procedimento atual (inativo)" },
        ]
      : procedimentos;

  async function salvar() {
    setErro(null);
    setGravando(true);
    try {
      const resultado = await editarPaciente(
        paciente.id,
        nome,
        telefone,
        especialidade === "" ? null : Number(especialidade),
      );
      if (resultado.ok) aoTerminar(resultado.mensagem, true);
      else setErro(resultado.mensagem);
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <Moldura
      titulo="Editar informações"
      subtitulo={paciente.nome}
      icone={<Pencil className="h-4 w-4 text-herval-verdeEscuro" />}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" onClick={aoFechar} className={botaoSecundario}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={gravando}
            className={botaoPrincipal}
          >
            {gravando ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          void salvar();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-black/60">
            Nome completo
          </span>
          <input
            className={campo}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-black/60">
            Telefone (WhatsApp)
          </span>
          <input
            className={campo}
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="tel"
            placeholder="(11) 99999-8888"
            required
          />
        </label>

        {telefoneMudou && (
          <p className="flex gap-2 rounded-controle bg-herval-atencao/10 px-3 py-2.5 text-xs font-medium leading-relaxed text-herval-atencao">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A conversa da Helô é ligada ao número. Com o telefone novo, as
            mensagens antigas continuam no histórico do paciente, mas a
            próxima mensagem que vier do número antigo pode criar um paciente
            novo.
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-black/60">
            Procedimento de interesse
          </span>
          <select
            className={campo}
            value={especialidade}
            onChange={(e) => setEspecialidade(e.target.value)}
          >
            <option value="">Não informado</option>
            {opcoes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>

        {/* Enter no campo salva, como em qualquer formulário. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
      <Erro texto={erro} />
    </Moldura>
  );
}

// ---------------------------------------------------------------------------
// Confirmar exclusão
// ---------------------------------------------------------------------------

export function ModalExcluir({
  pacientes,
  aoFechar,
  aoTerminar,
}: {
  pacientes: { id: number; nome: string }[];
  aoFechar: () => void;
  aoTerminar: AoTerminar;
}) {
  const [entendi, setEntendi] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const quantos = pacientes.length;

  async function excluir() {
    setErro(null);
    setGravando(true);
    try {
      const resultado = await excluirPacientes(pacientes.map((p) => p.id));
      aoTerminar(resultado.mensagem, resultado.ok);
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
      setGravando(false);
    }
  }

  return (
    <Moldura
      titulo={quantos === 1 ? "Excluir paciente" : `Excluir ${quantos} pacientes`}
      icone={<Trash2 className="h-4 w-4 text-herval-vermelho" />}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" onClick={aoFechar} className={botaoSecundario}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={excluir}
            disabled={!entendi || gravando}
            className={botaoPerigo}
          >
            {gravando
              ? "Excluindo..."
              : quantos === 1
                ? "Excluir"
                : `Excluir ${quantos}`}
          </button>
        </>
      }
    >
      <ul className="max-h-40 space-y-1 overflow-y-auto rounded-controle bg-black/[0.03] px-3 py-2.5">
        {pacientes.map((p) => (
          <li key={p.id} className="truncate text-sm font-bold text-herval-preto">
            {p.nome}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2 text-xs font-medium leading-relaxed text-black/65">
        <p>
          A exclusão é definitiva. Junto com o paciente saem as mensagens, os
          agendamentos, as vendas, as notas, as tarefas e o histórico de etapas
          dele, e os relatórios deixam de contá-lo.
        </p>
        <p>
          A conversa no WhatsApp não é apagada: se a pessoa mandar mensagem de
          novo, ela volta como paciente novo.
        </p>
      </div>

      <label className="mt-4 flex items-start gap-2 text-xs font-bold text-herval-preto">
        <input
          type="checkbox"
          checked={entendi}
          onChange={(e) => setEntendi(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-herval-vermelho"
        />
        Entendo que não dá para desfazer.
      </label>

      <Erro texto={erro} />
    </Moldura>
  );
}

// ---------------------------------------------------------------------------
// Alterar etapa em lote
// ---------------------------------------------------------------------------

export function ModalEtapaEmLote({
  ids,
  aoFechar,
  aoTerminar,
}: {
  ids: number[];
  aoFechar: () => void;
  aoTerminar: AoTerminar;
}) {
  const [etapa, setEtapa] = useState("");
  const [motivo, setMotivo] = useState("");
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pedeMotivo = etapa === ETAPA_PERDIDA;
  const pronto = etapa !== "" && (!pedeMotivo || motivo !== "");

  async function mover() {
    setErro(null);
    setGravando(true);
    try {
      const resultado = await moverPacientesDeEtapa(
        ids,
        etapa,
        pedeMotivo ? motivo : null,
      );
      aoTerminar(resultado.mensagem, resultado.ok);
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
      setGravando(false);
    }
  }

  return (
    <Moldura
      titulo="Alterar etapa"
      subtitulo={
        ids.length === 1 ? "1 paciente selecionado" : `${ids.length} pacientes selecionados`
      }
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" onClick={aoFechar} className={botaoSecundario}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={mover}
            disabled={!pronto || gravando}
            className={botaoPrincipal}
          >
            {gravando ? "Movendo..." : "Mover"}
          </button>
        </>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-black/60">
          Mover para
        </span>
        <select className={campo} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
          <option value="">Escolha a etapa</option>
          {etapasFunil
            .filter((opcao) => opcao !== ETAPA_GANHA)
            .map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
        </select>
      </label>

      {pedeMotivo && (
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-bold text-black/60">
            Motivo da perda (vale para todos)
          </span>
          <select className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Escolha o motivo</option>
            {motivosDePerda.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
          {apoioDoMotivo[motivo] && (
            <span className="mt-1.5 block text-[11px] font-medium text-black/45">
              {apoioDoMotivo[motivo]}
            </span>
          )}
        </label>
      )}

      <p className="mt-4 text-xs font-medium leading-relaxed text-black/50">
        Venda Ganha não aparece aqui porque pede a venda de cada paciente
        (valor e procedimento). Para ela, use o menu de três pontos do
        paciente.
      </p>

      <Erro texto={erro} />
    </Moldura>
  );
}

// ---------------------------------------------------------------------------
// Importar
// ---------------------------------------------------------------------------

/**
 * O Excel em português salva CSV em Windows-1252 quando a pessoa não escolhe
 * "CSV UTF-8". Ler sempre como UTF-8 transformaria "João" em "Jo�o", então
 * a leitura tenta UTF-8 estrito e cai para Windows-1252 se não for.
 */
async function lerTextoDoArquivo(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function baixarArquivo(conteudo: string, nome: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const endereco = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

export function ModalImportar({
  clientes,
  clienteInicial,
  escolherCliente,
  aoFechar,
  aoTerminar,
}: {
  clientes: OpcaoSimples[];
  clienteInicial: number | null;
  /** Só a Herval escolhe a clínica. O cliente importa para a própria. */
  escolherCliente: boolean;
  aoFechar: () => void;
  aoTerminar: AoTerminar;
}) {
  const [cliente, setCliente] = useState<string>(
    clienteInicial === null ? "" : String(clienteInicial),
  );
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<PreviaDaImportacao | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolherArquivo(lista: FileList | null) {
    setErro(null);
    setPrevia(null);
    const escolhido = lista?.[0];
    if (!escolhido) return;
    setArquivo(escolhido.name);
    try {
      setPrevia(lerPlanilha(await lerTextoDoArquivo(escolhido)));
    } catch {
      setErro("Não deu para ler o arquivo. Salve como CSV e tente de novo.");
    }
  }

  const naRegua =
    previa?.validas.filter((linha) => ETAPAS_DA_REGUA.includes(linha.etapa))
      .length ?? 0;

  const porEtapa = new Map<string, number>();
  for (const linha of previa?.validas ?? []) {
    porEtapa.set(linha.etapa, (porEtapa.get(linha.etapa) ?? 0) + 1);
  }

  const grandeDemais = (previa?.validas.length ?? 0) > TETO_DA_IMPORTACAO;
  const pronto =
    previa !== null &&
    previa.validas.length > 0 &&
    !grandeDemais &&
    (!escolherCliente || cliente !== "");

  async function importar() {
    if (!previa) return;
    setErro(null);
    setGravando(true);
    try {
      const resultado = await importarPacientes(
        escolherCliente ? Number(cliente) : 0,
        previa.validas,
      );
      if (resultado.ok) aoTerminar(resultado.mensagem, true);
      else {
        setErro(resultado.mensagem);
        setGravando(false);
      }
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
      setGravando(false);
    }
  }

  return (
    <Moldura
      titulo="Importar pacientes"
      icone={<FileUp className="h-4 w-4 text-herval-verdeEscuro" />}
      largura="max-w-lg"
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" onClick={aoFechar} className={botaoSecundario}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={importar}
            disabled={!pronto || gravando}
            className={botaoPrincipal}
          >
            {gravando
              ? "Importando..."
              : previa && previa.validas.length > 0
                ? `Importar ${previa.validas.length}`
                : "Importar"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-xs font-medium leading-relaxed text-black/60">
          <p>
            Arquivo CSV com as colunas <strong>Nome</strong>,{" "}
            <strong>Telefone</strong> e, se quiser, <strong>Etapa</strong>. Sem
            etapa, o paciente entra em Leads Recebidos. Quem já está cadastrado
            com o mesmo telefone não é alterado.
          </p>
          <button
            type="button"
            onClick={() =>
              baixarArquivo(
                "﻿Nome;Telefone;Etapa\r\nMaria da Silva;(11) 99999-8888;Leads Recebidos\r\n",
                "modelo-importacao-pacientes.csv",
              )
            }
            className="mt-2 inline-flex items-center gap-1 font-bold text-herval-preto underline-offset-2 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar modelo
          </button>
        </div>

        {escolherCliente && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-black/60">
              Clínica que recebe os pacientes
            </span>
            <select className={campo} value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">Escolha a clínica</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-card border border-dashed border-black/25 px-4 py-6 text-center transition-colors hover:border-herval-verde">
          <FileUp className="h-5 w-5 text-black/45" />
          <span className="text-sm font-bold text-herval-preto">
            {arquivo ?? "Escolher arquivo .csv"}
          </span>
          <span className="text-[11px] font-medium text-black/45">
            Até {TETO_DA_IMPORTACAO} pacientes por arquivo
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void escolherArquivo(e.target.files)}
          />
        </label>

        {previa && (
          <div className="space-y-3 rounded-controle bg-black/[0.03] px-3.5 py-3 text-xs font-medium text-black/65">
            <p>
              <span className="text-sm font-extrabold text-herval-preto">
                {previa.validas.length}
              </span>{" "}
              {previa.validas.length === 1 ? "paciente pronto" : "pacientes prontos"} para
              importar
              {previa.repetidasNoArquivo > 0 &&
                ` · ${previa.repetidasNoArquivo} telefone(s) repetido(s) no arquivo, entra só a primeira linha`}
              .
            </p>

            {porEtapa.size > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {[...porEtapa].map(([etapa, quantos]) => (
                  <li
                    key={etapa}
                    className="rounded-full bg-herval-branco px-2.5 py-1 font-bold text-black/65"
                  >
                    {etapa}: {quantos}
                  </li>
                ))}
              </ul>
            )}

            {grandeDemais && (
              <p className="font-bold text-herval-vermelho">
                O arquivo passou de {TETO_DA_IMPORTACAO} pacientes. Divida em
                partes.
              </p>
            )}

            {naRegua > 0 && (
              <p className="flex gap-2 rounded-controle bg-herval-atencao/10 px-3 py-2.5 leading-relaxed text-herval-atencao">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {naRegua} {naRegua === 1 ? "paciente vai entrar" : "pacientes vão entrar"} em
                etapas da régua de follow-up (Em Contato a F7). A régua pode
                mandar mensagem automática para eles pelo WhatsApp.
              </p>
            )}

            {previa.recusadas.length > 0 && (
              <div>
                <p className="font-bold text-herval-preto">
                  {previa.recusadas.length}{" "}
                  {previa.recusadas.length === 1 ? "linha não entra" : "linhas não entram"}:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {previa.recusadas.slice(0, 8).map((recusa) => (
                    <li key={recusa.linha}>
                      Linha {recusa.linha}: {recusa.motivo}
                    </li>
                  ))}
                  {previa.recusadas.length > 8 && (
                    <li>e mais {previa.recusadas.length - 8}.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      <Erro texto={erro} />
    </Moldura>
  );
}

// ---------------------------------------------------------------------------
// Duplicados
// ---------------------------------------------------------------------------

export function ModalDuplicados({
  cliente,
  podeExcluir,
  mostrarCliente,
  aoFechar,
  aoMudar,
}: {
  cliente: number | null;
  podeExcluir: boolean;
  mostrarCliente: boolean;
  aoFechar: () => void;
  /** Depois de excluir alguém daqui, a lista da página também muda. */
  aoMudar: () => void;
}) {
  const [grupos, setGrupos] = useState<GrupoDeDuplicados[] | null>(null);
  const [cortado, setCortado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    buscarDuplicados(cliente === null ? null : String(cliente))
      .then((resultado) => {
        if (!ativo) return;
        if (resultado.ok) {
          setGrupos(resultado.grupos);
          setCortado(resultado.cortado);
        } else {
          setErro(resultado.mensagem);
        }
      })
      .catch(() => {
        if (ativo) setErro("Não deu para falar com o servidor. Tente de novo.");
      });
    return () => {
      ativo = false;
    };
  }, [cliente, versao]);

  async function excluir(id: number) {
    setErro(null);
    setExcluindo(id);
    try {
      const resultado = await excluirPacientes([id]);
      if (!resultado.ok) setErro(resultado.mensagem);
      setConfirmando(null);
      aoMudar();
      setVersao((atual) => atual + 1);
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <Moldura
      titulo="Possíveis duplicados"
      subtitulo="Mesmo telefone (com ou sem o nono dígito) ou mesmo nome completo, dentro da mesma clínica"
      icone={<Copy className="h-4 w-4 text-herval-verdeEscuro" />}
      largura="max-w-2xl"
      aoFechar={aoFechar}
    >
      {grupos === null && !erro && (
        <p className="py-6 text-center text-sm font-medium text-black/45">
          Procurando...
        </p>
      )}

      {grupos !== null && grupos.length === 0 && (
        <p className="py-6 text-center text-sm font-medium text-black/55">
          Nenhum duplicado encontrado.
        </p>
      )}

      {cortado && (
        <p className="mb-3 text-xs font-bold text-herval-atencao">
          A base é grande e a busca parou nos primeiros 20 mil pacientes.
        </p>
      )}

      <div className="space-y-4">
        {(grupos ?? []).map((grupo, indice) => (
          <section
            key={`${grupo.motivo}-${grupo.pacientes[0]?.id ?? indice}`}
            className="rounded-controle border border-black/10"
          >
            <header className="border-b border-black/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-black/45">
              {grupo.motivo}
            </header>
            <ul className="divide-y divide-black/5">
              {grupo.pacientes.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-herval-preto">
                      {p.nome}
                    </p>
                    <p className="text-xs font-medium text-black/50">
                      {formatarTelefone(p.telefone)} · {p.etapa} · chegou em{" "}
                      {formatarDataCurta(p.criadoEm)}
                      {mostrarCliente && p.cliente ? ` · ${p.cliente}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/atendimento/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-black/55 hover:text-herval-preto"
                    >
                      Abrir
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    {podeExcluir &&
                      (confirmando === p.id ? (
                        <button
                          type="button"
                          onClick={() => void excluir(p.id)}
                          disabled={excluindo !== null}
                          className="rounded-full bg-herval-vermelho px-3 py-1 text-xs font-extrabold text-herval-branco disabled:opacity-50"
                        >
                          {excluindo === p.id ? "Excluindo..." : "Confirmar exclusão"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmando(p.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-black/15 px-3 py-1 text-xs font-bold text-black/60 hover:border-herval-vermelho hover:text-herval-vermelho"
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir
                        </button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {podeExcluir && (grupos?.length ?? 0) > 0 && (
        <p className="mt-4 text-[11px] font-medium leading-relaxed text-black/45">
          Excluir aqui é definitivo e leva junto as mensagens, agendamentos e
          vendas daquele registro. Antes de excluir, abra os dois e confira
          qual tem o histórico.
        </p>
      )}

      <Erro texto={erro} />
    </Moldura>
  );
}
