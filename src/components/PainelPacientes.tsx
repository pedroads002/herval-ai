"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Layers,
  ListChecks,
  Pencil,
  Search,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import MenuDeEtapa, { type PassoDoMenu } from "@/components/MenuDeEtapa";
import VendasDoLead from "@/components/VendasDoLead";
import {
  baixarArquivo,
  ModalDuplicados,
  ModalEditar,
  ModalEtapaEmLote,
  ModalExcluir,
  ModalImportar,
} from "@/components/ModaisDePacientes";
import type { DadosDaMovimentacao } from "@/components/ProvedorLeads";
import { moverLeadDeEtapa } from "@/lib/acoes/funil";
import { exportarPacientes } from "@/lib/acoes/pacientes";
import { ETAPA_GANHA, etapasFunil, type EtapaFunil } from "@/data/leads";
import { formatarReais } from "@/lib/dados/linhaDeVenda";
import {
  formatarTelefone,
  limparBusca,
  montarCsv,
  PACIENTES_POR_PAGINA,
  type OpcaoSimples,
  type PacienteDaLista,
} from "@/lib/dados/linhaDePaciente";

/**
 * A tela de Pacientes.
 *
 * Os filtros moram na URL (`?etapa=…&busca=…&pagina=…`), e quem filtra e
 * pagina é o banco: a tela recebe só os 25 da página. Trocar o filtro é
 * navegar, e o servidor responde com a página nova. Assim um link copiado
 * abre a mesma lista, e uma base de milhares de pacientes não precisa descer
 * inteira para o navegador.
 *
 * Toda gravação termina com `router.refresh()`: a lista só muda quando o
 * banco confirmou, nunca antes.
 */

type Filtros = {
  clienteId: number | null;
  etapa: EtapaFunil | null;
  busca: string;
  pagina: number;
};

type Modal =
  | { tipo: "editar"; paciente: PacienteDaLista }
  | { tipo: "excluir"; pacientes: { id: number; nome: string }[] }
  | { tipo: "etapaEmLote"; ids: number[] }
  | { tipo: "importar" }
  | { tipo: "duplicados" }
  | { tipo: "venda"; id: number; nome: string }
  | null;

type Aviso = { texto: string; ok: boolean } | null;

export default function PainelPacientes({
  pacientes,
  totalNaBase,
  outrosContatos,
  totalFiltrado,
  totalVendido,
  vendasLidas,
  clientes,
  procedimentos,
  podeExcluir,
  mostrarCliente,
  falha,
  filtros,
}: {
  pacientes: PacienteDaLista[];
  totalNaBase: number;
  outrosContatos: number;
  totalFiltrado: number;
  totalVendido: number;
  vendasLidas: boolean;
  clientes: OpcaoSimples[];
  procedimentos: OpcaoSimples[];
  podeExcluir: boolean;
  mostrarCliente: boolean;
  falha: string | null;
  filtros: Filtros;
}) {
  const router = useRouter();
  const [carregando, iniciarTransicao] = useTransition();
  const [busca, setBusca] = useState(filtros.busca);
  const [modal, setModal] = useState<Modal>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [menuAberto, setMenuAberto] = useState<number | null>(null);
  const [exportando, setExportando] = useState(false);

  const totalDePaginas = Math.max(1, Math.ceil(totalFiltrado / PACIENTES_POR_PAGINA));

  // Muda a URL. Filtro novo volta para a primeira página; a seleção se perde
  // porque ela vale para os pacientes que estão na tela.
  function navegar(mudancas: Partial<Filtros>) {
    const proximos = { ...filtros, pagina: 1, ...mudancas };
    const parametros = new URLSearchParams();
    if (proximos.clienteId !== null) parametros.set("cliente", String(proximos.clienteId));
    if (proximos.etapa !== null) parametros.set("etapa", proximos.etapa);
    if (proximos.busca !== "") parametros.set("busca", proximos.busca);
    if (proximos.pagina > 1) parametros.set("pagina", String(proximos.pagina));

    const texto = parametros.toString();
    setSelecionados(new Set());
    setMenuAberto(null);
    iniciarTransicao(() => {
      router.push(texto ? `/pacientes?${texto}` : "/pacientes");
    });
  }

  // A busca espera a pessoa parar de digitar, para não navegar a cada letra.
  // O termo é comparado já limpo (`limparBusca`, o mesmo do servidor): sem
  // isso, "(11)" e o "11" que volta na URL pareceriam diferentes, e a tela
  // navegaria de novo à toa.
  const navegarRef = useRef(navegar);
  useEffect(() => {
    navegarRef.current = navegar;
  });
  useEffect(() => {
    const termo = limparBusca(busca);
    if (termo === filtros.busca) return;
    const espera = setTimeout(() => navegarRef.current({ busca: termo }), 400);
    return () => clearTimeout(espera);
  }, [busca, filtros.busca]);

  function terminar(texto: string, ok: boolean) {
    setModal(null);
    setAviso({ texto, ok });
    setSelecionados(new Set());
    iniciarTransicao(() => router.refresh());
  }

  function alternarSelecao(id: number) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const todosDaPaginaMarcados =
    pacientes.length > 0 && pacientes.every((p) => selecionados.has(p.id));

  function alternarTodos() {
    setSelecionados(
      todosDaPaginaMarcados ? new Set() : new Set(pacientes.map((p) => p.id)),
    );
  }

  const listaSelecionada = pacientes.filter((p) => selecionados.has(p.id));

  async function exportar() {
    setAcoesAbertas(false);
    setExportando(true);
    setAviso(null);
    try {
      const resultado = await exportarPacientes({
        cliente: filtros.clienteId === null ? undefined : String(filtros.clienteId),
        etapa: filtros.etapa ?? undefined,
        busca: filtros.busca || undefined,
      });
      if (!resultado.ok) {
        setAviso({ texto: resultado.mensagem, ok: false });
        return;
      }
      const hoje = new Date().toISOString().slice(0, 10);
      baixarArquivo(montarCsv(resultado.linhas), `pacientes-${hoje}.csv`);
      setAviso({
        texto: resultado.cortado
          ? `Exportados os primeiros ${resultado.linhas.length} pacientes. A base passou do teto de uma exportação.`
          : `${resultado.linhas.length} ${resultado.linhas.length === 1 ? "paciente exportado" : "pacientes exportados"}.`,
        ok: !resultado.cortado,
      });
    } catch {
      setAviso({ texto: "Não deu para falar com o servidor. Tente de novo.", ok: false });
    } finally {
      setExportando(false);
    }
  }

  function excluirSelecionados() {
    setAcoesAbertas(false);
    if (listaSelecionada.length === 0) {
      setSelecionando(true);
      setAviso({ texto: "Marque os pacientes que quer excluir e clique em Excluir.", ok: true });
      return;
    }
    setModal({
      tipo: "excluir",
      pacientes: listaSelecionada.map((p) => ({ id: p.id, nome: p.nome })),
    });
  }

  async function moverUm(
    paciente: PacienteDaLista,
    destino: EtapaFunil,
    dados?: DadosDaMovimentacao,
  ) {
    setMenuAberto(null);
    setAviso(null);

    // Venda Ganha pede a venda; é a gravação dela que move o paciente — o
    // mesmo caminho do Funil e do Atendimento.
    if (destino === ETAPA_GANHA) {
      setModal({ tipo: "venda", id: paciente.id, nome: paciente.nome });
      return;
    }

    try {
      const resultado = await moverLeadDeEtapa(
        paciente.id,
        destino,
        dados?.motivoPerda ?? null,
      );
      terminar(
        resultado.ok ? `${paciente.nome} movido para "${destino}".` : resultado.mensagem,
        resultado.ok,
      );
    } catch {
      setAviso({ texto: "Não deu para falar com o servidor. Tente de novo.", ok: false });
    }
  }

  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  const primeiro = totalFiltrado === 0 ? 0 : (filtros.pagina - 1) * PACIENTES_POR_PAGINA + 1;
  const ultimo = Math.min(filtros.pagina * PACIENTES_POR_PAGINA, totalFiltrado);

  return (
    <div className="space-y-6">
      {/* Topo: totais e ações em lote */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <div className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/45">
              <UserRound className="h-3.5 w-3.5" />
              Pacientes
            </p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-herval-preto">
              {(totalNaBase - outrosContatos).toLocaleString("pt-BR")}
            </p>
            <p className="mt-1 text-xs font-medium text-black/45">
              {mostrarCliente && filtros.clienteId === null
                ? "Na base de todos os clientes"
                : "Na base da clínica"}
              {outrosContatos > 0 &&
                ` · mais ${outrosContatos.toLocaleString("pt-BR")} em Outros Contatos`}
            </p>
          </div>
          <div className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/45">
              <Trophy className="h-3.5 w-3.5" />
              Vendas ganhas
            </p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-herval-preto">
              {vendasLidas ? formatarReais(totalVendido) : "—"}
            </p>
            <p className="mt-1 text-xs font-medium text-black/45">
              {vendasLidas
                ? "Soma das vendas registradas, de todo o período"
                : "Não deu para ler as vendas agora"}
            </p>
          </div>
        </div>

        <div className="relative flex shrink-0 items-start lg:items-center">
          <button
            type="button"
            onClick={() => setAcoesAbertas((atual) => !atual)}
            aria-expanded={acoesAbertas}
            className="inline-flex items-center gap-2 rounded-full bg-herval-preto px-5 py-3 text-sm font-extrabold text-herval-branco transition-opacity hover:opacity-90"
          >
            <Layers className="h-4 w-4" />
            {exportando ? "Exportando..." : "Ações em lote"}
            <ChevronDown className="h-4 w-4" />
          </button>

          {acoesAbertas && (
            <MenuFlutuante aoFechar={() => setAcoesAbertas(false)} className="right-0 top-full mt-2 w-60">
              <ItemDoMenu
                icone={<FileUp className="h-4 w-4" />}
                rotulo="Importar"
                aoClicar={() => {
                  setAcoesAbertas(false);
                  setModal({ tipo: "importar" });
                }}
              />
              <ItemDoMenu
                icone={<Download className="h-4 w-4" />}
                rotulo="Exportar"
                apoio="Todos os pacientes do filtro atual"
                aoClicar={() => void exportar()}
              />
              <ItemDoMenu
                icone={<ListChecks className="h-4 w-4" />}
                rotulo={selecionando ? "Parar de selecionar" : "Selecionar vários"}
                aoClicar={() => {
                  setAcoesAbertas(false);
                  setSelecionando((atual) => !atual);
                  setSelecionados(new Set());
                }}
              />
              <ItemDoMenu
                icone={<Copy className="h-4 w-4" />}
                rotulo="Duplicados"
                aoClicar={() => {
                  setAcoesAbertas(false);
                  setModal({ tipo: "duplicados" });
                }}
              />
              {podeExcluir && (
                <ItemDoMenu
                  icone={<Trash2 className="h-4 w-4" />}
                  rotulo="Excluir pacientes"
                  perigo
                  apoio={
                    listaSelecionada.length > 0
                      ? `${listaSelecionada.length} selecionado(s)`
                      : "Marque os pacientes antes"
                  }
                  aoClicar={excluirSelecionados}
                />
              )}
            </MenuFlutuante>
          )}
        </div>
      </div>

      {/* Filtro e busca */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {mostrarCliente && (
          <select
            aria-label="Cliente"
            value={filtros.clienteId === null ? "" : String(filtros.clienteId)}
            onChange={(e) =>
              navegar({ clienteId: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="rounded-full border border-black/15 bg-herval-branco px-4 py-2.5 text-sm font-bold text-herval-preto outline-none focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Filtrar por etapa do funil"
          value={filtros.etapa ?? ""}
          onChange={(e) =>
            navegar({ etapa: e.target.value === "" ? null : (e.target.value as EtapaFunil) })
          }
          className="rounded-full border border-black/15 bg-herval-branco px-4 py-2.5 text-sm font-bold text-herval-preto outline-none focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
        >
          <option value="">Todas as etapas</option>
          {etapasFunil.map((etapa) => (
            <option key={etapa} value={etapa}>
              {etapa}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full rounded-full border border-black/15 bg-herval-branco py-2.5 pl-11 pr-4 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
          />
        </div>
      </div>

      {aviso && (
        <div
          role="status"
          className={[
            "flex items-start justify-between gap-3 rounded-card border px-5 py-3.5",
            aviso.ok
              ? "border-herval-verde/40 bg-herval-verde/10"
              : "border-herval-vermelho/30 bg-herval-vermelho/5",
          ].join(" ")}
        >
          <p className="text-sm font-medium text-black/70">{aviso.texto}</p>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Fechar aviso"
            className="text-black/40 hover:text-herval-preto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Barra da seleção */}
      {selecionando && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-black/10 bg-black/[0.03] px-4 py-3">
          <span className="text-sm font-bold text-herval-preto">
            {listaSelecionada.length === 0
              ? "Nenhum paciente marcado"
              : listaSelecionada.length === 1
                ? "1 paciente marcado"
                : `${listaSelecionada.length} pacientes marcados`}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              disabled={listaSelecionada.length === 0}
              onClick={() =>
                setModal({ tipo: "etapaEmLote", ids: listaSelecionada.map((p) => p.id) })
              }
              className="rounded-full border border-black/15 bg-herval-branco px-3.5 py-2 text-xs font-bold text-black/70 hover:border-herval-verde hover:text-herval-preto disabled:opacity-40"
            >
              Alterar etapa
            </button>
            {podeExcluir && (
              <button
                type="button"
                disabled={listaSelecionada.length === 0}
                onClick={excluirSelecionados}
                className="rounded-full border border-herval-vermelho/40 bg-herval-branco px-3.5 py-2 text-xs font-bold text-herval-vermelho hover:bg-herval-vermelho/5 disabled:opacity-40"
              >
                Excluir
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelecionando(false);
                setSelecionados(new Set());
              }}
              className="rounded-full px-3.5 py-2 text-xs font-bold text-black/55 hover:text-herval-preto"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div
        className={[
          "overflow-visible rounded-card border border-black/10 bg-herval-branco shadow-card transition-opacity",
          carregando ? "opacity-60" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-black/45 sm:px-5">
          {selecionando && (
            <input
              type="checkbox"
              aria-label="Marcar todos desta página"
              checked={todosDaPaginaMarcados}
              onChange={alternarTodos}
              className="h-4 w-4 accent-herval-verde"
            />
          )}
          <span className="flex-1">Nome</span>
          <span className="hidden w-40 sm:block">Telefone</span>
          <span className="hidden w-44 md:block">Etapa do funil</span>
          <span className="w-8" />
        </div>

        {pacientes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm font-medium text-black/45">
            {filtros.busca || filtros.etapa
              ? "Nenhum paciente com esse filtro."
              : "Nenhum paciente cadastrado ainda."}
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {pacientes.map((paciente) => (
              <LinhaDoPaciente
                key={paciente.id}
                paciente={paciente}
                mostrarCliente={mostrarCliente}
                selecionando={selecionando}
                marcado={selecionados.has(paciente.id)}
                aoMarcar={() => alternarSelecao(paciente.id)}
                menuAberto={menuAberto === paciente.id}
                aoAbrirMenu={() =>
                  setMenuAberto((atual) => (atual === paciente.id ? null : paciente.id))
                }
                aoFecharMenu={() => setMenuAberto(null)}
                podeExcluir={podeExcluir}
                aoEditar={() => {
                  setMenuAberto(null);
                  setModal({ tipo: "editar", paciente });
                }}
                aoMover={(destino, dados) => void moverUm(paciente, destino, dados)}
                aoExcluir={() => {
                  setMenuAberto(null);
                  setModal({
                    tipo: "excluir",
                    pacientes: [{ id: paciente.id, nome: paciente.nome }],
                  });
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Paginação */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-black/55">
        <p>
          {totalFiltrado === 0 ? (
            "0 pacientes"
          ) : (
            <>
              <span className="font-extrabold text-herval-preto">
                {primeiro}–{ultimo}
              </span>{" "}
              de{" "}
              <span className="font-extrabold text-herval-preto">
                {totalFiltrado.toLocaleString("pt-BR")}
              </span>{" "}
              {totalFiltrado === 1 ? "paciente" : "pacientes"}
              {totalFiltrado !== totalNaBase && " no filtro"} · em ordem alfabética
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={filtros.pagina <= 1 || carregando}
            onClick={() => navegar({ pagina: filtros.pagina - 1 })}
            className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-herval-branco px-3.5 py-2 text-xs font-bold text-black/70 hover:border-herval-verde disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </button>
          <span className="text-xs font-bold tabular-nums">
            Página {Math.min(filtros.pagina, totalDePaginas)} de {totalDePaginas}
          </span>
          <button
            type="button"
            disabled={filtros.pagina >= totalDePaginas || carregando}
            onClick={() => navegar({ pagina: filtros.pagina + 1 })}
            className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-herval-branco px-3.5 py-2 text-xs font-bold text-black/70 hover:border-herval-verde disabled:opacity-40"
          >
            Próxima
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Modais */}
      {modal?.tipo === "editar" && (
        <ModalEditar
          paciente={modal.paciente}
          procedimentos={procedimentos}
          aoFechar={() => setModal(null)}
          aoTerminar={terminar}
        />
      )}
      {modal?.tipo === "excluir" && (
        <ModalExcluir
          pacientes={modal.pacientes}
          aoFechar={() => setModal(null)}
          aoTerminar={(texto, ok) => {
            if (ok) setSelecionando(false);
            terminar(texto, ok);
          }}
        />
      )}
      {modal?.tipo === "etapaEmLote" && (
        <ModalEtapaEmLote
          ids={modal.ids}
          aoFechar={() => setModal(null)}
          aoTerminar={terminar}
        />
      )}
      {modal?.tipo === "importar" && (
        <ModalImportar
          clientes={clientes}
          clienteInicial={filtros.clienteId}
          escolherCliente={mostrarCliente}
          aoFechar={() => setModal(null)}
          aoTerminar={terminar}
        />
      )}
      {modal?.tipo === "duplicados" && (
        <ModalDuplicados
          cliente={filtros.clienteId}
          podeExcluir={podeExcluir}
          mostrarCliente={mostrarCliente}
          aoFechar={() => setModal(null)}
          aoMudar={() => iniciarTransicao(() => router.refresh())}
        />
      )}
      {modal?.tipo === "venda" && (
        <VendasDoLead
          key={modal.id}
          leadId={modal.id}
          leadNome={modal.nome}
          comecarRegistrando
          aoFechar={() => {
            setModal(null);
            iniciarTransicao(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha
// ---------------------------------------------------------------------------

function LinhaDoPaciente({
  paciente,
  mostrarCliente,
  selecionando,
  marcado,
  aoMarcar,
  menuAberto,
  aoAbrirMenu,
  aoFecharMenu,
  podeExcluir,
  aoEditar,
  aoMover,
  aoExcluir,
}: {
  paciente: PacienteDaLista;
  mostrarCliente: boolean;
  selecionando: boolean;
  marcado: boolean;
  aoMarcar: () => void;
  menuAberto: boolean;
  aoAbrirMenu: () => void;
  aoFecharMenu: () => void;
  podeExcluir: boolean;
  aoEditar: () => void;
  aoMover: (etapa: EtapaFunil, dados?: DadosDaMovimentacao) => void;
  aoExcluir: () => void;
}) {
  const [passo, setPasso] = useState<"acoes" | PassoDoMenu>("acoes");
  const telefone = formatarTelefone(paciente.telefone);

  return (
    <li
      className={[
        "relative flex items-center gap-3 px-4 py-3 sm:px-5",
        marcado ? "bg-herval-verde/10" : "",
      ].join(" ")}
    >
      {selecionando && (
        <input
          type="checkbox"
          aria-label={`Marcar ${paciente.nome}`}
          checked={marcado}
          onChange={aoMarcar}
          className="h-4 w-4 shrink-0 accent-herval-verde"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-herval-preto">{paciente.nome}</p>
        <p className="truncate text-xs font-medium text-black/45">
          <span className="sm:hidden">{telefone} · </span>
          <span className="md:hidden">{paciente.etapa}</span>
          {mostrarCliente && paciente.cliente && (
            <span className="hidden md:inline">{paciente.cliente}</span>
          )}
        </p>
      </div>

      <span className="hidden w-40 shrink-0 text-sm font-medium tabular-nums text-black/65 sm:block">
        {telefone}
      </span>

      <span className="hidden w-44 shrink-0 md:block">
        <span className="inline-flex max-w-full truncate rounded-full bg-herval-verde/15 px-2.5 py-1 text-xs font-bold text-herval-preto">
          {paciente.etapa}
        </span>
      </span>

      <div className="relative w-8 shrink-0">
        <button
          type="button"
          onClick={() => {
            // Toda abertura começa pelas três opções, não pelo passo em que
            // o menu foi fechado da última vez.
            setPasso("acoes");
            aoAbrirMenu();
          }}
          aria-label={`Opções de ${paciente.nome}`}
          aria-expanded={menuAberto}
          className={[
            "rounded-full p-1.5 transition-colors",
            menuAberto
              ? "bg-herval-preto text-herval-branco"
              : "text-black/45 hover:bg-black/5 hover:text-herval-preto",
          ].join(" ")}
        >
          <TresPontos />
        </button>

        {menuAberto && (
          <MenuFlutuante aoFechar={aoFecharMenu} className="right-0 top-full mt-1 w-64">
            {passo === "acoes" ? (
              <>
                <ItemDoMenu
                  icone={<Pencil className="h-4 w-4" />}
                  rotulo="Editar informações"
                  aoClicar={aoEditar}
                />
                <ItemDoMenu
                  icone={<Layers className="h-4 w-4" />}
                  rotulo="Alterar etapa"
                  apoio={`Agora em ${paciente.etapa}`}
                  aoClicar={() => setPasso("etapa")}
                />
                <Link
                  href={`/atendimento/${paciente.id}`}
                  className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm font-bold text-black/70 transition-colors hover:bg-black/5 hover:text-herval-preto"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir conversa
                </Link>
                {podeExcluir && (
                  <ItemDoMenu
                    icone={<Trash2 className="h-4 w-4" />}
                    rotulo="Excluir"
                    perigo
                    aoClicar={aoExcluir}
                  />
                )}
              </>
            ) : (
              <div className="p-1">
                <MenuDeEtapa
                  etapaAtual={paciente.etapa as EtapaFunil}
                  passo={passo}
                  aoPedirPasso={setPasso}
                  aoMover={aoMover}
                />
              </div>
            )}
          </MenuFlutuante>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Menu flutuante
// ---------------------------------------------------------------------------

/** Fecha clicando fora ou no Esc, como os outros menus do painel. */
function MenuFlutuante({
  aoFechar,
  className,
  children,
}: {
  aoFechar: () => void;
  className: string;
  children: React.ReactNode;
}) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target as Node;
      // O clique no próprio botão que abriu o menu já alterna sozinho.
      if (caixaRef.current?.parentElement?.contains(alvo)) return;
      aoFecharRef.current();
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") aoFecharRef.current();
    }
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  return (
    <div
      ref={caixaRef}
      className={`absolute z-30 rounded-controle border border-black/10 bg-herval-branco p-1.5 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

function ItemDoMenu({
  icone,
  rotulo,
  apoio,
  perigo = false,
  aoClicar,
}: {
  icone: React.ReactNode;
  rotulo: string;
  apoio?: string;
  perigo?: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={[
        "flex w-full items-start gap-2.5 rounded px-2.5 py-2 text-left text-sm font-bold transition-colors",
        perigo
          ? "text-herval-vermelho hover:bg-herval-vermelho/5"
          : "text-black/70 hover:bg-black/5 hover:text-herval-preto",
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0">{icone}</span>
      <span>
        {rotulo}
        {apoio && (
          <span className="mt-0.5 block text-[11px] font-medium text-black/45">{apoio}</span>
        )}
      </span>
    </button>
  );
}

/** Os três pontinhos verticais do menu de cada paciente. */
function TresPontos() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}
