"use client";

import { useState } from "react";
import { Bot, User, Zap, Bell } from "lucide-react";
import { regrasIniciais, type ExecutorRegra, type RegraAutomacao } from "@/data/reguaAutomacao";

const iconeExecutor: Record<ExecutorRegra, typeof Bot> = {
  IA: Bot,
  Humano: User,
  Automática: Zap,
};

export default function TabelaRegua() {
  const [regras, setRegras] = useState<RegraAutomacao[]>(regrasIniciais);

  // Só muda o estado desta tela. Nada é enviado nem salvo.
  function alternarAtivo(id: number) {
    setRegras((atuais) =>
      atuais.map((regra) =>
        regra.id === id ? { ...regra, ativo: !regra.ativo } : regra,
      ),
    );
  }

  const ativas = regras.filter((r) => r.ativo).length;
  const humanas = regras.filter((r) => r.executor === "Humano").length;

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">{ativas}</span> de{" "}
        <span className="font-extrabold text-herval-preto">{regras.length}</span>{" "}
        regras ativas ·{" "}
        <span className="font-extrabold text-herval-preto">{humanas}</span>{" "}
        {humanas === 1 ? "depende" : "dependem"} de ação humana.
      </p>

      <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b border-black/10 bg-black/[0.03] text-left text-xs uppercase tracking-wider text-black/50">
              <tr>
                <th className="px-6 py-4 font-bold">Gatilho</th>
                <th className="px-6 py-4 font-bold">Condição</th>
                <th className="px-6 py-4 font-bold">Ação</th>
                <th className="px-6 py-4 font-bold">Espera</th>
                <th className="w-28 px-6 py-4 font-bold">Ativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.07]">
              {regras.map((regra) => {
                const humana = regra.executor === "Humano";
                const IconeExec = iconeExecutor[regra.executor];

                return (
                  <tr
                    key={regra.id}
                    className={
                      humana
                        ? "bg-herval-verde/[0.07]"
                        : "transition-colors hover:bg-herval-verde/[0.06]"
                    }
                  >
                    <td className="px-6 py-5">
                      <span className="block font-bold text-herval-preto">
                        {regra.gatilho}
                      </span>
                      <span
                        className={[
                          "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                          humana
                            ? "bg-herval-preto text-herval-branco"
                            : "border border-black/20 text-black/60",
                        ].join(" ")}
                      >
                        <IconeExec className="h-3 w-3" />
                        {regra.executor}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-black/65">{regra.condicao}</td>

                    <td className="px-6 py-5">
                      {humana ? (
                        <span className="inline-flex items-start gap-2 font-bold text-herval-preto">
                          <Bell className="mt-0.5 h-4 w-4 shrink-0" />
                          {regra.acao}
                        </span>
                      ) : (
                        <span className="text-black/65">{regra.acao}</span>
                      )}
                    </td>

                    <td className="px-6 py-5 font-medium text-black/65">
                      {regra.espera}
                    </td>

                    <td className="px-6 py-5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={regra.ativo}
                        aria-label={`${regra.ativo ? "Desligar" : "Ligar"} regra ${regra.gatilho}`}
                        onClick={() => alternarAtivo(regra.id)}
                        className={[
                          "relative h-7 w-12 rounded-full transition-colors",
                          regra.ativo ? "bg-herval-verde" : "bg-black/20",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "absolute top-1 h-5 w-5 rounded-full bg-herval-branco transition-all",
                            regra.ativo ? "left-6" : "left-1",
                          ].join(" ")}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs font-medium text-black/45">
        As regras destacadas em verde com selo &quot;Humano&quot; nunca são
        executadas pela IA: ela apenas avisa a equipe. O primeiro contato de lead
        novo é sempre feito por uma pessoa.
      </p>
    </div>
  );
}
