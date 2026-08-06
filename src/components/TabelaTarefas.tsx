"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import Etiqueta from "@/components/Etiqueta";
import {
  tarefasIniciais,
  type StatusTarefa,
  type Tarefa,
} from "@/data/tarefas";

const tomDoStatus: Record<StatusTarefa, "atencao" | "sucesso" | "erro"> = {
  Pendente: "atencao",
  Aprovado: "sucesso",
  Rejeitado: "erro",
};

export default function TabelaTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);

  // Só muda o estado desta tela. Nada é enviado nem salvo.
  function definirStatus(id: number, status: StatusTarefa) {
    setTarefas((atuais) =>
      atuais.map((tarefa) =>
        tarefa.id === id ? { ...tarefa, status } : tarefa,
      ),
    );
  }

  const pendentes = tarefas.filter((t) => t.status === "Pendente").length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {pendentes === 0
          ? "Nenhuma tarefa pendente."
          : `${pendentes} ${pendentes === 1 ? "tarefa pendente" : "tarefas pendentes"}.`}
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Lead</th>
                <th className="px-5 py-3 font-medium">Regra disparada</th>
                <th className="px-5 py-3 font-medium">Ação sugerida</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tarefas.map((tarefa) => {
                const aprovada = tarefa.status === "Aprovado";
                const rejeitada = tarefa.status === "Rejeitado";

                return (
                  <tr key={tarefa.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {tarefa.lead}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{tarefa.regra}</td>
                    <td className="px-5 py-4 text-slate-600">{tarefa.acao}</td>
                    <td className="px-5 py-4">
                      <Etiqueta
                        texto={tarefa.status}
                        tom={tomDoStatus[tarefa.status]}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-pressed={aprovada}
                          onClick={() => definirStatus(tarefa.id, "Aprovado")}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                            aprovada
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700",
                          ].join(" ")}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Aprovar
                        </button>
                        <button
                          type="button"
                          aria-pressed={rejeitada}
                          onClick={() => definirStatus(tarefa.id, "Rejeitado")}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                            rejeitada
                              ? "bg-rose-600 text-white hover:bg-rose-700"
                              : "border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700",
                          ].join(" ")}
                        >
                          <X className="h-3.5 w-3.5" />
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
