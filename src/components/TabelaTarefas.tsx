"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import Etiqueta, { type TomEtiqueta } from "@/components/Etiqueta";
import {
  tarefasIniciais,
  type StatusTarefa,
  type Tarefa,
} from "@/data/tarefas";

const tomDoStatus: Record<StatusTarefa, TomEtiqueta> = {
  Pendente: "contorno",
  Aprovado: "verde",
  Rejeitado: "preto",
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
    <div className="space-y-5">
      <p className="text-sm font-medium text-black/55">
        {pendentes === 0 ? (
          "Nenhuma tarefa pendente."
        ) : (
          <>
            <span className="font-extrabold text-herval-preto">{pendentes}</span>{" "}
            {pendentes === 1 ? "tarefa pendente" : "tarefas pendentes"}.
          </>
        )}
      </p>

      <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-black/10 bg-black/[0.03] text-left text-xs uppercase tracking-wider text-black/50">
              <tr>
                <th className="px-6 py-4 font-bold">Lead</th>
                <th className="px-6 py-4 font-bold">Regra disparada</th>
                <th className="px-6 py-4 font-bold">Ação sugerida</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.07]">
              {tarefas.map((tarefa) => {
                const aprovada = tarefa.status === "Aprovado";
                const rejeitada = tarefa.status === "Rejeitado";

                return (
                  <tr
                    key={tarefa.id}
                    className="transition-colors hover:bg-herval-verde/[0.06]"
                  >
                    <td className="px-6 py-5 font-bold text-herval-preto">
                      {tarefa.lead}
                    </td>
                    <td className="px-6 py-5 text-black/65">{tarefa.regra}</td>
                    <td className="px-6 py-5 text-black/65">{tarefa.acao}</td>
                    <td className="px-6 py-5">
                      <Etiqueta
                        texto={tarefa.status}
                        tom={tomDoStatus[tarefa.status]}
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-pressed={aprovada}
                          onClick={() => definirStatus(tarefa.id, "Aprovado")}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
                            aprovada
                              ? "bg-herval-verde text-herval-preto hover:bg-herval-verdeEscuro"
                              : "border border-black/15 text-black/70 hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto",
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
                            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
                            rejeitada
                              ? "bg-herval-preto text-herval-branco hover:bg-black/85"
                              : "border border-black/15 text-black/70 hover:border-herval-preto hover:bg-black/5 hover:text-herval-preto",
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
