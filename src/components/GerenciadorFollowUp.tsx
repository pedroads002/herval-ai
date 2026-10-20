"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Check, X, AlertCircle, Clock } from "lucide-react";
import {
  ETAPAS_DE_FOLLOW_UP,
  type EtapaDeFollowUp,
  type MensagemFollowUp,
} from "@/lib/dados/followUp";
import {
  cadastrarMensagemFollowUp,
  editarMensagemFollowUp,
  excluirMensagemFollowUp,
} from "@/lib/acoes/followUp";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const botaoLinha =
  "inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors disabled:opacity-50";

type GrupoPorEtapa = Record<EtapaDeFollowUp, MensagemFollowUp[]>;

/**
 * Os textos de follow-up (régua de automação), lidos e gravados em
 * `follow_up_mensagens` — ver `lib/dados/followUp.ts` e `lib/acoes/followUp.ts`.
 * É a mesma tabela que o n8n já lê direto no SQL para montar as mensagens de
 * reativação; esta tela ganhou a mesma leitura e passou a gravar nela.
 *
 * Cada etapa (F1 a F7) tem uma ou mais "bolhas", na ordem em que são
 * enviadas. Esta tela edita só as linhas padrão (`clinica_id` nulo) — não há
 * override por clínica ainda.
 */
export default function GerenciadorFollowUp({
  porEtapaInicial,
  falha,
}: {
  porEtapaInicial: GrupoPorEtapa;
  falha: string | null;
}) {
  const [porEtapa, setPorEtapa] = useState<GrupoPorEtapa>(porEtapaInicial);

  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-bold text-herval-preto">
          Não deu para carregar os textos de follow-up.
        </p>
        <p className="mt-1 text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ETAPAS_DE_FOLLOW_UP.map((etapa) => (
        <EtapaCartao
          key={etapa}
          etapa={etapa}
          mensagens={porEtapa[etapa]}
          aoMudar={(mensagens) =>
            setPorEtapa((atual) => ({ ...atual, [etapa]: mensagens }))
          }
        />
      ))}
    </div>
  );
}

function EtapaCartao({
  etapa,
  mensagens,
  aoMudar,
}: {
  etapa: EtapaDeFollowUp;
  mensagens: MensagemFollowUp[];
  aoMudar: (mensagens: MensagemFollowUp[]) => void;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [emEdicao, setEmEdicao] = useState<number | null>(null);
  const [edicaoTexto, setEdicaoTexto] = useState("");
  const [edicaoEspera, setEdicaoEspera] = useState("3");
  const [erroDaLinha, setErroDaLinha] = useState("");

  const [adicionando, setAdicionando] = useState(false);
  const [novoTexto, setNovoTexto] = useState("");
  const [novaEspera, setNovaEspera] = useState("3");
  const [erroDeAdicao, setErroDeAdicao] = useState("");

  function iniciarEdicao(item: MensagemFollowUp) {
    setEmEdicao(item.id);
    setEdicaoTexto(item.texto);
    setEdicaoEspera(String(item.delaySegundos));
    setErroDaLinha("");
  }

  function cancelarEdicao() {
    setEmEdicao(null);
    setEdicaoTexto("");
    setErroDaLinha("");
  }

  function salvarEdicao(id: number) {
    if (!edicaoTexto.trim()) {
      setErroDaLinha("Preencha o texto da mensagem.");
      return;
    }

    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("texto", edicaoTexto.trim());
    formData.set("delay_segundos", edicaoEspera);

    iniciarTransicao(async () => {
      const resultado = await editarMensagemFollowUp(RESULTADO_INICIAL, formData);

      if (!resultado.ok) {
        setErroDaLinha(resultado.mensagem);
        return;
      }

      aoMudar(
        mensagens.map((m) =>
          m.id === id
            ? { ...m, texto: edicaoTexto.trim(), delaySegundos: Number(edicaoEspera) }
            : m,
        ),
      );
      cancelarEdicao();
    });
  }

  function excluir(id: number) {
    iniciarTransicao(async () => {
      const formData = new FormData();
      formData.set("id", String(id));
      const resultado = await excluirMensagemFollowUp(RESULTADO_INICIAL, formData);

      if (!resultado.ok) {
        setErroDaLinha(resultado.mensagem);
        return;
      }

      aoMudar(mensagens.filter((m) => m.id !== id));
      if (emEdicao === id) cancelarEdicao();
    });
  }

  function adicionar() {
    if (!novoTexto.trim()) {
      setErroDeAdicao("Preencha o texto da mensagem.");
      return;
    }

    const formData = new FormData();
    formData.set("etapa", etapa);
    formData.set("texto", novoTexto.trim());
    formData.set("delay_segundos", novaEspera);

    iniciarTransicao(async () => {
      const resultado = await cadastrarMensagemFollowUp(RESULTADO_INICIAL, formData);

      if (!resultado.ok) {
        setErroDeAdicao(resultado.mensagem);
        return;
      }

      if (resultado.mensagemFollowUp) {
        aoMudar([...mensagens, resultado.mensagemFollowUp]);
      }
      setNovoTexto("");
      setNovaEspera("3");
      setErroDeAdicao("");
      setAdicionando(false);
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
      <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.03] px-6 py-4">
        <h2 className="text-sm font-extrabold tracking-tight text-herval-preto">
          Etapa {etapa}
        </h2>
        <span className="text-xs font-medium text-black/45">
          {mensagens.length} {mensagens.length === 1 ? "mensagem" : "mensagens"}
        </span>
      </div>

      <div className="divide-y divide-black/[0.07]">
        {mensagens.length === 0 && !adicionando && (
          <p className="px-6 py-6 text-sm font-medium text-black/50">
            Nenhuma mensagem cadastrada nesta etapa.
          </p>
        )}

        {mensagens.map((item, indice) =>
          emEdicao === item.id ? (
            <div key={item.id} className="space-y-3 bg-herval-verde/[0.07] px-6 py-5">
              <textarea
                rows={3}
                value={edicaoTexto}
                onChange={(e) => setEdicaoTexto(e.target.value)}
                className={campoBase}
              />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-black/60">
                  <Clock className="h-3.5 w-3.5" />
                  Espera (segundos)
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={edicaoEspera}
                    onChange={(e) => setEdicaoEspera(e.target.value)}
                    className="w-20 rounded-controle border border-black/15 bg-herval-branco px-3 py-1.5 text-sm text-herval-preto outline-none focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => salvarEdicao(item.id)}
                  disabled={pendente}
                  className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-3.5 py-2 text-xs font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {pendente ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  disabled={pendente}
                  className={`${botaoLinha} hover:border-herval-preto hover:bg-black/5 hover:text-herval-preto`}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </button>
              </div>
              {erroDaLinha && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-herval-vermelho">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {erroDaLinha}
                </p>
              )}
            </div>
          ) : (
            <div key={item.id} className="flex items-start gap-4 px-6 py-5">
              <span className="mt-0.5 shrink-0 text-xs font-bold text-black/35">
                {indice + 1}
              </span>
              <div className="flex-1">
                <p className="whitespace-pre-line text-sm text-herval-preto">
                  {item.texto}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-black/45">
                  <Clock className="h-3.5 w-3.5" />
                  Espera de {item.delaySegundos}s antes de enviar
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => iniciarEdicao(item)}
                  disabled={pendente}
                  className={`${botaoLinha} hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => excluir(item.id)}
                  disabled={pendente}
                  className={`${botaoLinha} hover:border-herval-preto hover:bg-herval-preto hover:text-herval-branco`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
              </div>
            </div>
          ),
        )}

        {adicionando && (
          <div className="space-y-3 bg-herval-verde/[0.07] px-6 py-5">
            <textarea
              rows={3}
              value={novoTexto}
              onChange={(e) => setNovoTexto(e.target.value)}
              placeholder="Texto da nova mensagem"
              className={campoBase}
            />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-black/60">
                <Clock className="h-3.5 w-3.5" />
                Espera (segundos)
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={novaEspera}
                  onChange={(e) => setNovaEspera(e.target.value)}
                  className="w-20 rounded-controle border border-black/15 bg-herval-branco px-3 py-1.5 text-sm text-herval-preto outline-none focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
                />
              </label>
              <button
                type="button"
                onClick={adicionar}
                disabled={pendente}
                className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-3.5 py-2 text-xs font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {pendente ? "Adicionando…" : "Adicionar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdicionando(false);
                  setErroDeAdicao("");
                  setNovoTexto("");
                }}
                disabled={pendente}
                className={`${botaoLinha} hover:border-herval-preto hover:bg-black/5 hover:text-herval-preto`}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
            </div>
            {erroDeAdicao && (
              <p className="flex items-center gap-1.5 text-xs font-bold text-herval-vermelho">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {erroDeAdicao}
              </p>
            )}
          </div>
        )}
      </div>

      {!adicionando && (
        <div className="border-t border-black/10 px-6 py-4">
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar mensagem a esta etapa
          </button>
        </div>
      )}
    </div>
  );
}
