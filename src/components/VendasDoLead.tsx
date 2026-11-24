"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Pencil, Plus, Trash2, Trophy, X } from "lucide-react";
import {
  apagarVenda,
  carregarVendasDoLead,
  salvarVenda,
  type VendasDoLead as DadosDasVendas,
} from "@/lib/acoes/vendas";
import {
  formatarDataDaVenda,
  formatarReais,
  hojeEmBrasilia,
  somarVendas,
  type VendaDoFormulario,
  type VendaDoLead,
} from "@/lib/dados/linhaDeVenda";

/**
 * As vendas de um lead, num modal só para o Funil e para o Atendimento.
 *
 * Duas portas de entrada:
 * - `comecarRegistrando`: o Funil, ao mover um card para "Venda Ganha", abre
 *   direto no formulário. Mover sem venda deixaria a etapa sem o valor que a
 *   explica — o mesmo raciocínio de "Venda Perdida" cobrar o motivo.
 * - sem ele: a lista das vendas do lead, para corrigir, apagar ou registrar
 *   mais uma (o paciente que volta e fecha outro procedimento).
 *
 * Obrigatórios: valor e procedimento. A data vem preenchida com hoje.
 */
export default function VendasDoLead({
  leadId,
  leadNome,
  comecarRegistrando = false,
  aoFechar,
  aoMudar,
}: {
  leadId: number;
  leadNome: string;
  comecarRegistrando?: boolean;
  aoFechar: () => void;
  /** Chamado depois de cada gravação confirmada, com as vendas atuais. */
  aoMudar?: (vendas: VendaDoLead[], registrou: boolean) => void;
}) {
  const [dados, setDados] = useState<DadosDasVendas | null>(null);
  const [editando, setEditando] = useState<VendaDoLead | "nova" | null>(
    comecarRegistrando ? "nova" : null,
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const botaoFecharRef = useRef<HTMLButtonElement>(null);

  const recarregar = useCallback(async () => {
    try {
      const lido = await carregarVendasDoLead(leadId);
      setDados(lido);
      return lido;
    } catch {
      setDados({
        vendas: [],
        procedimentos: [],
        formasPagamento: [],
        falha: "Não deu para falar com o servidor. Tente de novo.",
      });
      return null;
    }
  }, [leadId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    botaoFecharRef.current?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  async function depoisDeGravar(mensagemDeAviso?: string, registrou = false) {
    const lido = await recarregar();
    if (lido && !lido.falha) aoMudar?.(lido.vendas, registrou);
    setAviso(mensagemDeAviso ?? null);
    // Veio do "Mover para Venda Ganha": registrou, terminou.
    if (comecarRegistrando && !mensagemDeAviso) {
      aoFechar();
      return;
    }
    setEditando(null);
  }

  const vendas = dados?.vendas ?? [];
  const total = somarVendas(vendas);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-vendas"
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-card border border-black/10 bg-herval-branco shadow-card"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="titulo-vendas"
              className="inline-flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-herval-preto"
            >
              <Trophy className="h-4 w-4 text-herval-verdeEscuro" />
              {editando === "nova"
                ? "Registrar venda"
                : editando
                  ? "Corrigir venda"
                  : "Vendas"}
            </h2>
            <p className="mt-1 truncate text-xs font-medium text-black/55">
              {leadNome}
              {vendas.length > 0 && editando === null && (
                <>
                  {" · "}
                  <span className="font-extrabold text-herval-preto">
                    {formatarReais(total)}
                  </span>{" "}
                  em {vendas.length} {vendas.length === 1 ? "venda" : "vendas"}
                </>
              )}
            </p>
          </div>
          <button
            ref={botaoFecharRef}
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-black/45 transition-colors hover:bg-black/5 hover:text-herval-preto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {aviso && (
            <p
              role="status"
              className="mb-3 rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto"
            >
              {aviso}
            </p>
          )}

          {dados === null ? (
            <p className="py-6 text-center text-xs font-medium text-black/45">
              Carregando…
            </p>
          ) : dados.falha ? (
            <p
              role="alert"
              className="rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto"
            >
              {dados.falha}
            </p>
          ) : editando !== null ? (
            <FormularioDeVenda
              leadId={leadId}
              venda={editando === "nova" ? null : editando}
              procedimentos={dados.procedimentos}
              formasPagamento={dados.formasPagamento}
              textoDoBotao={
                editando === "nova" && comecarRegistrando
                  ? "Registrar e mover para Venda Ganha"
                  : editando === "nova"
                    ? "Registrar venda"
                    : "Salvar correção"
              }
              aoCancelar={() => (comecarRegistrando ? aoFechar() : setEditando(null))}
              aoGravar={depoisDeGravar}
            />
          ) : (
            <ListaDeVendas
              leadId={leadId}
              vendas={vendas}
              aoEditar={setEditando}
              aoApagar={depoisDeGravar}
            />
          )}
        </div>

        {dados && !dados.falha && editando === null && (
          <div className="flex shrink-0 justify-end border-t border-black/10 px-5 py-3">
            <button
              type="button"
              onClick={() => {
                setAviso(null);
                setEditando("nova");
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-4 py-2 text-xs font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar venda
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ListaDeVendas({
  leadId,
  vendas,
  aoEditar,
  aoApagar,
}: {
  leadId: number;
  vendas: VendaDoLead[];
  aoEditar: (venda: VendaDoLead) => void;
  aoApagar: (aviso?: string) => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (vendas.length === 0) {
    return (
      <p className="py-6 text-center text-xs font-medium text-black/45">
        Nenhuma venda registrada para este lead.
      </p>
    );
  }

  async function apagar(id: number) {
    setApagando(true);
    setErro(null);
    try {
      const resultado = await apagarVenda(id, leadId);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setConfirmando(null);
      await aoApagar();
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setApagando(false);
    }
  }

  return (
    <ul className="space-y-2.5">
      {erro && (
        <li
          role="alert"
          className="rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto"
        >
          {erro}
        </li>
      )}
      {vendas.map((venda) => (
        <li
          key={venda.id}
          className="rounded-controle border border-black/10 px-3.5 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold tabular-nums text-herval-preto">
                {formatarReais(venda.valor)}
              </p>
              <p className="mt-0.5 text-xs font-bold text-black/70">
                {venda.procedimento}
              </p>
              <p className="mt-1 text-[11px] font-medium text-black/45">
                {formatarDataDaVenda(venda.dataVenda)}
                {venda.formaPagamento && ` · ${venda.formaPagamento}`}
                {venda.parcelas && venda.parcelas > 1 && ` · ${venda.parcelas}x`}
                {venda.registradoPorNome && ` · por ${venda.registradoPorNome}`}
              </p>
              {venda.observacao && (
                <p className="mt-1 text-[11px] font-medium leading-snug text-black/55">
                  {venda.observacao}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => aoEditar(venda)}
                title="Corrigir venda"
                aria-label="Corrigir venda"
                className="rounded-full p-1.5 text-black/45 transition-colors hover:bg-black/5 hover:text-herval-preto"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(venda.id)}
                title="Apagar venda"
                aria-label="Apagar venda"
                className="rounded-full p-1.5 text-black/45 transition-colors hover:bg-herval-vermelho/10 hover:text-herval-vermelho"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {confirmando === venda.id && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-controle bg-herval-vermelho/5 px-3 py-2">
              <span className="text-[11px] font-bold text-herval-preto">
                Apagar esta venda? Não dá para desfazer.
              </span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  className="rounded-full border border-black/15 px-3 py-1 text-[11px] font-extrabold text-black/70"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={apagando}
                  onClick={() => apagar(venda.id)}
                  className="rounded-full bg-herval-preto px-3 py-1 text-[11px] font-extrabold text-herval-branco disabled:opacity-60"
                >
                  {apagando ? "Apagando…" : "Apagar"}
                </button>
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const rotulo = "text-[11px] font-bold uppercase tracking-wide text-black/45";
const campo =
  "mt-1.5 w-full rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-2 focus:ring-herval-verde/25";

function FormularioDeVenda({
  leadId,
  venda,
  procedimentos,
  formasPagamento,
  textoDoBotao,
  aoCancelar,
  aoGravar,
}: {
  leadId: number;
  venda: VendaDoLead | null;
  procedimentos: string[];
  formasPagamento: string[];
  textoDoBotao: string;
  aoCancelar: () => void;
  aoGravar: (aviso?: string, registrou?: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<VendaDoFormulario>(() => ({
    ...(venda ? { id: venda.id } : {}),
    leadId,
    valor: venda
      ? venda.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : "",
    procedimento: venda?.procedimento ?? "",
    dataVenda: venda?.dataVenda ?? hojeEmBrasilia(),
    formaPagamento: venda?.formaPagamento ?? "",
    parcelas: venda?.parcelas ? String(venda.parcelas) : "",
    observacao: venda?.observacao ?? "",
  }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const primeiroCampoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    primeiroCampoRef.current?.focus();
  }, []);

  // A forma gravada antes pode ter saído da lista da clínica; ela continua
  // aparecendo para a correção não apagá-la sem querer.
  const formas =
    form.formaPagamento && !formasPagamento.includes(form.formaPagamento)
      ? [...formasPagamento, form.formaPagamento]
      : formasPagamento;

  function mudar(campoAlterado: keyof VendaDoFormulario, valor: string) {
    setForm((atual) => ({ ...atual, [campoAlterado]: valor }));
    setErro(null);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await salvarVenda(form);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      await aoGravar(resultado.aviso, venda === null);
    } catch {
      setErro("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3.5" noValidate>
      <label className="block">
        <span className={rotulo}>Valor pago *</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm font-bold text-black/45">
            R$
          </span>
          <input
            ref={primeiroCampoRef}
            inputMode="decimal"
            value={form.valor}
            onChange={(e) => mudar("valor", e.target.value)}
            placeholder="1.500,00"
            className={`${campo} pl-10 tabular-nums`}
          />
        </div>
      </label>

      <label className="block">
        <span className={rotulo}>Procedimento *</span>
        <input
          list={`procedimentos-${leadId}`}
          value={form.procedimento}
          onChange={(e) => mudar("procedimento", e.target.value)}
          placeholder={
            procedimentos.length > 0
              ? "Escolha da lista ou escreva"
              : "Ex.: Lipo de papada"
          }
          maxLength={120}
          className={campo}
        />
        <datalist id={`procedimentos-${leadId}`}>
          {procedimentos.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={rotulo}>Data da venda</span>
          <input
            type="date"
            value={form.dataVenda}
            max={hojeEmBrasilia()}
            onChange={(e) => mudar("dataVenda", e.target.value)}
            className={campo}
          />
        </label>
        <label className="block">
          <span className={rotulo}>Parcelas</span>
          <input
            type="number"
            min={1}
            max={48}
            inputMode="numeric"
            value={form.parcelas}
            onChange={(e) => mudar("parcelas", e.target.value)}
            placeholder="À vista"
            className={campo}
          />
        </label>
      </div>

      <label className="block">
        <span className={rotulo}>Forma de pagamento</span>
        {formas.length > 0 ? (
          <select
            value={form.formaPagamento}
            onChange={(e) => mudar("formaPagamento", e.target.value)}
            className={campo}
          >
            <option value="">Não informada</option>
            {formas.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={form.formaPagamento}
            onChange={(e) => mudar("formaPagamento", e.target.value)}
            placeholder="Ex.: Pix"
            maxLength={60}
            className={campo}
          />
        )}
      </label>

      <label className="block">
        <span className={rotulo}>Observação</span>
        <textarea
          value={form.observacao}
          onChange={(e) => mudar("observacao", e.target.value)}
          rows={2}
          maxLength={500}
          className={`${campo} resize-none`}
        />
      </label>

      {erro && (
        <p
          role="alert"
          className="rounded-controle bg-herval-vermelho/10 px-3 py-2 text-xs font-medium text-herval-preto"
        >
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={aoCancelar}
          className="rounded-full border border-black/15 px-4 py-2 text-xs font-extrabold text-black/70 transition-colors hover:border-herval-verde hover:text-herval-preto"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-4 py-2 text-xs font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trophy className="h-3.5 w-3.5" />
          {salvando ? "Gravando…" : textoDoBotao}
        </button>
      </div>
    </form>
  );
}
