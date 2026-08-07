"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Check, X, AlertCircle } from "lucide-react";
import { objecoesIniciais, type Objecao } from "@/data/objecoes";

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const botaoLinha =
  "inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors";

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
    <div className="space-y-8">
      {/* Formulário de nova objeção */}
      <div className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
        <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
          <span className="h-4 w-1 rounded-full bg-herval-verde" />
          Nova objeção
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-black/50">
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-black/50">
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

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={adicionar}
            className="inline-flex items-center gap-2 rounded-full bg-herval-verde px-5 py-3 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
          {erro ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/20 px-3.5 py-2 text-xs font-bold text-herval-preto">
              <AlertCircle className="h-3.5 w-3.5" />
              {erro}
            </span>
          ) : (
            <span className="text-xs font-medium text-black/45">
              Tela de demonstração: nada é salvo ainda.
            </span>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-black/10 bg-black/[0.03] text-left text-xs uppercase tracking-wider text-black/50">
              <tr>
                <th className="w-64 px-6 py-4 font-bold">Objeção</th>
                <th className="px-6 py-4 font-bold">Resposta padrão</th>
                <th className="w-20 px-6 py-4 text-right font-bold">Usos</th>
                <th className="w-44 px-6 py-4 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.07]">
              {objecoes.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-14 text-center font-medium text-black/50"
                  >
                    Nenhuma objeção cadastrada. Use o formulário acima para
                    adicionar.
                  </td>
                </tr>
              )}

              {objecoes.map((item) =>
                emEdicao === item.id ? (
                  <tr key={item.id} className="bg-herval-verde/[0.07]">
                    <td className="px-6 py-5 align-top">
                      <input
                        type="text"
                        value={edicaoObjecao}
                        onChange={(e) => setEdicaoObjecao(e.target.value)}
                        className={campoBase}
                      />
                    </td>
                    <td className="px-6 py-5 align-top">
                      <textarea
                        rows={2}
                        value={edicaoResposta}
                        onChange={(e) => setEdicaoResposta(e.target.value)}
                        className={campoBase}
                      />
                    </td>
                    <td className="px-6 py-5 text-right align-top font-bold tabular-nums text-herval-preto">
                      {item.usos}
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => salvarEdicao(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-3.5 py-2 text-xs font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicao}
                          className={`${botaoLinha} hover:border-herval-preto hover:bg-black/5 hover:text-herval-preto`}
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-herval-verde/[0.06]"
                  >
                    <td className="px-6 py-5 font-bold text-herval-preto">
                      {item.objecao}
                    </td>
                    <td className="px-6 py-5 text-black/65">{item.resposta}</td>
                    <td className="px-6 py-5 text-right font-bold tabular-nums text-herval-preto">
                      {item.usos}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(item)}
                          className={`${botaoLinha} hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluir(item.id)}
                          className={`${botaoLinha} hover:border-herval-preto hover:bg-herval-preto hover:text-herval-branco`}
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
