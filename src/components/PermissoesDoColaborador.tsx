"use client";

import { useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

/**
 * O controle de quais das quatro telas opcionais (Leads, Conversas,
 * Relatórios, Agenda) um colaborador vê — por colaborador, dentro da própria
 * linha dele em "Quem tem acesso" (ver `ListaDeEquipe`).
 *
 * Repete as chaves de tela como texto literal, em vez de importar
 * `TELAS_CONTROLAVEIS` de `@/lib/autorizacao`: aquele arquivo carrega
 * `next/headers` por baixo (via `criarClienteServidor`), e um Client
 * Component que importasse dali quebraria o build — mesmo motivo de
 * `MenuLateralCliente` nunca ter importado nada dali.
 *
 * `telasPermitidas` vindo `null` é "sem restrição configurada" — as quatro
 * aparecem marcadas por padrão, até alguém desmarcar e salvar pela primeira
 * vez. Salva em `/api/admin/equipe/permissoes`, que confere de novo (no
 * servidor) que quem está chamando é o `cliente_admin` da MESMA clínica deste
 * colaborador — este componente só evita mostrar o controle para quem não
 * devia (`cliente_admin`), não é a tranca de verdade.
 */
const TELAS_DO_FORMULARIO = [
  { tela: "funil", rotulo: "Leads" },
  { tela: "atendimento", rotulo: "Conversas" },
  { tela: "relatorios", rotulo: "Relatórios" },
  { tela: "agenda", rotulo: "Agenda" },
] as const;

const TODAS_AS_TELAS = TELAS_DO_FORMULARIO.map((item) => item.tela);

export default function PermissoesDoColaborador({
  usuarioId,
  telasPermitidas,
}: {
  usuarioId: string;
  telasPermitidas: string[] | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>(
    telasPermitidas ?? [...TODAS_AS_TELAS],
  );
  const [estado, setEstado] = useState<
    | { situacao: "ocioso" }
    | { situacao: "salvando" }
    | { situacao: "erro"; motivo: string }
    | { situacao: "salvo" }
  >({ situacao: "ocioso" });

  function alternar(tela: string) {
    setEstado({ situacao: "ocioso" });
    setSelecionadas((atual) =>
      atual.includes(tela) ? atual.filter((item) => item !== tela) : [...atual, tela],
    );
  }

  async function salvar() {
    setEstado({ situacao: "salvando" });

    const resposta = await fetch("/api/admin/equipe/permissoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId, telas: selecionadas }),
    }).catch(() => null);

    const corpo = await resposta?.json().catch(() => null);

    if (!resposta || !corpo?.ok) {
      setEstado({
        situacao: "erro",
        motivo: corpo?.motivo || "Não deu para salvar. Tente de novo.",
      });
      return;
    }

    setEstado({ situacao: "salvo" });
  }

  return (
    <div className="rounded-controle border border-black/10 bg-black/[0.015] px-3.5 py-3">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="flex w-full items-center justify-between text-xs font-bold text-black/60 transition-colors hover:text-herval-preto"
      >
        Telas liberadas
        {aberto ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {aberto && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {TELAS_DO_FORMULARIO.map(({ tela, rotulo }) => (
              <label
                key={tela}
                className="flex items-center gap-2 text-sm font-medium text-herval-preto"
              >
                <input
                  type="checkbox"
                  checked={selecionadas.includes(tela)}
                  onChange={() => alternar(tela)}
                  className="h-4 w-4 rounded border-black/25 text-herval-verde focus:ring-herval-verde"
                />
                {rotulo}
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={estado.situacao === "salvando"}
              className="inline-flex items-center gap-1.5 rounded-full bg-herval-preto px-4 py-2 text-xs font-bold text-herval-branco transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {estado.situacao === "salvando" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {estado.situacao === "salvando" ? "Salvando…" : "Salvar"}
            </button>

            {estado.situacao === "salvo" && (
              <span className="text-xs font-bold text-herval-verde">Salvo.</span>
            )}
          </div>

          {estado.situacao === "erro" && (
            <p
              role="alert"
              className="flex items-start gap-2 text-xs font-medium text-herval-vermelho"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {estado.motivo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
