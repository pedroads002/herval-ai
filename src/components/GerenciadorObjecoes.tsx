"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { objecoesIniciais, type Objecao } from "@/data/objecoes";

const campoBase =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";

export default function GerenciadorObjecoes() {
  const [objecoes, setObjecoes] = useState<Objecao[]>(objecoesIniciais);

  // Formulário de nova objeção
  const [novaObjecao, setNovaObjecao] = useState("");
  const [novaResposta, setNovaResposta] = useState("");
  const [erro, setErro] = useState("");

  // Edição de uma linha existente
  const [emEdicao, setEmEdicao] = useState<number | null>(null);
  const [edicaoObjecao, setEdicaoObjecao] = useState("");
  const [edicaoResposta, setEdicaoResposta] = useState("");

  function adicionar() {
    if (!novaObjecao.trim() || !novaResposta.trim()) {
      setErro("Preencha a objeção e a resposta padrão.");
      return;
    }

    const proximoId = Math.max(0, ...objecoes.map((o) => o.id)) + 1;

    setObjecoes((atuais) => [
      {
        id: proximoId,
        objecao: novaObjecao.trim(),
        resposta: novaResposta.trim(),
        usos: 0,
      },
      ...atuais,
    ]);

    setNovaObjecao("");
    setNovaResposta("");
    setErro("");
  }

  function excluir(id: number) {
    setObjecoes((atuais) => atuais.filter((o) => o.id !== id));
    if (emEdicao === id) cancelarEdicao();
  }

  function iniciarEdicao(item: Objecao) {
    setEmEdicao(item.id);
    setEdicaoObjecao(item.objecao);
    setEdicaoResposta(item.resposta);
  }

  function cancelarEdicao() {
    setEmEdicao(null);
    setEdicaoObjecao("");
    setEdicaoResposta("");
  }

  function salvarEdicao(id: number) {
    if (!edicaoObjecao.trim() || !edicaoResposta.trim()) return;

    setObjecoes((atuais) =>
      atuais.map((o) =>
        o.id === id
          ? { ...o, objecao: edicaoObjecao.trim(), resposta: edicaoResposta.trim() }
          : o,
      ),
    );
    cancelarEdicao();
  }

  return (
    <div className="space-y-6">
      {/* Formulário de nova objeção */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Nova objeção</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Objeção
            </label>
            <input
              type="text"
              value={novaObjecao}
              onChange={(e) => setNovaObjecao(e.target.value)}
              placeholder="Ex.: Preciso ver minha agenda"
              className={campoBase}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Resposta padrão
            </label>
            <input
              type="text"
              value={novaResposta}
              onChange={(e) => setNovaResposta(e.target.value)}
              placeholder="Como a equipe deve responder"
              className={campoBase}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={adicionar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-4 py-2.5 text-sm font-medium text-white hover:bg-marca-escura"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
          {erro ? (
            <span className="text-xs text-rose-600">{erro}</span>
          ) : (
            <span className="text-xs text-slate-400">
              Tela de demonstração: nada é salvo ainda.
            </span>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-64 px-5 py-3 font-medium">Objeção</th>
                <th className="px-5 py-3 font-medium">Resposta padrão</th>
                <th className="w-20 px-5 py-3 text-right font-medium">Usos</th>
                <th className="w-40 px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {objecoes.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Nenhuma objeção cadastrada. Use o formulário acima para
                    adicionar.
                  </td>
                </tr>
              )}

              {objecoes.map((item) =>
                emEdicao === item.id ? (
                  <tr key={item.id} className="bg-marca-clara/60">
                    <td className="px-5 py-4 align-top">
                      <input
                        type="text"
                        value={edicaoObjecao}
                        onChange={(e) => setEdicaoObjecao(e.target.value)}
                        className={campoBase}
                      />
                    </td>
                    <td className="px-5 py-4 align-top">
                      <textarea
                        rows={2}
                        value={edicaoResposta}
                        onChange={(e) => setEdicaoResposta(e.target.value)}
                        className={campoBase}
                      />
                    </td>
                    <td className="px-5 py-4 text-right align-top tabular-nums text-slate-700">
                      {item.usos}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => salvarEdicao(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicao}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {item.objecao}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.resposta}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-700">
                      {item.usos}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluir(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
