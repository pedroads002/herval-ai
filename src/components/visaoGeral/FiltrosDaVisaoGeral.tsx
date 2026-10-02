"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  periodosDaVisao,
  type NomeDoPeriodo,
  type PeriodoEscolhido,
} from "@/lib/visaoGeral/periodo";
import type { ClinicaDaLista } from "@/lib/dados/visaoGeral";

/**
 * O período e a clínica da Visão Geral.
 *
 * Por que o filtro vai para o endereço (`?periodo=7d&clinica=3`) em vez de ficar
 * em estado do React: os números agora são lidos no banco, no servidor. Guardar
 * a escolha só no navegador obrigaria a tela a filtrar memória de novo — que é
 * exatamente o que fazia ela mostrar zero. Com a escolha na URL, o servidor
 * relê, e de brinde o endereço fica compartilhável.
 *
 * Mesmas classes do filtro que já existia aqui: nada de aparência mudou.
 */

const ESTILO_DE_CAMPO =
  "rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

export default function FiltrosDaVisaoGeral({
  periodo,
  clinicas,
  clinicaId,
}: {
  periodo: PeriodoEscolhido;
  clinicas: ClinicaDaLista[];
  clinicaId: number | null;
}) {
  const router = useRouter();
  const [de, setDe] = useState(periodo.intervalo.de);
  const [ate, setAte] = useState(periodo.intervalo.ate);

  function navegar(mudancas: Record<string, string | null>) {
    const parametros = new URLSearchParams();

    const atual: Record<string, string | null> = {
      periodo: periodo.nome,
      de: periodo.nome === "personalizado" ? periodo.intervalo.de : null,
      ate: periodo.nome === "personalizado" ? periodo.intervalo.ate : null,
      clinica: clinicaId === null ? null : String(clinicaId),
      ...mudancas,
    };

    for (const [chave, valor] of Object.entries(atual)) {
      if (valor !== null) parametros.set(chave, valor);
    }

    router.push(`/visao-geral?${parametros.toString()}`);
  }

  function escolherPeriodo(nome: NomeDoPeriodo) {
    if (nome === "personalizado") {
      // Abre já com o intervalo que está na tela, para a escolha não começar em
      // branco nem puxar dado de um período que ninguém pediu.
      navegar({ periodo: "personalizado", de, ate });
      return;
    }

    navegar({ periodo: nome, de: null, ate: null });
  }

  function mudarData(qual: "de" | "ate", valor: string) {
    if (qual === "de") setDe(valor);
    else setAte(valor);

    const novoDe = qual === "de" ? valor : de;
    const novoAte = qual === "ate" ? valor : ate;

    // Data pela metade não vira consulta: só recarrega quando as duas pontas
    // existem.
    if (novoDe && novoAte) {
      navegar({ periodo: "personalizado", de: novoDe, ate: novoAte });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="inline-flex rounded-full border border-black/15 bg-herval-branco p-1">
        {periodosDaVisao.map((opcao) => {
          const ativo = opcao.nome === periodo.nome;
          return (
            <button
              key={opcao.nome}
              type="button"
              onClick={() => escolherPeriodo(opcao.nome)}
              aria-pressed={ativo}
              className={[
                "rounded-full px-5 py-2 text-sm font-bold transition-colors",
                ativo
                  ? "bg-herval-verde text-herval-preto"
                  : "text-black/60 hover:bg-black/5 hover:text-herval-preto",
              ].join(" ")}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      {periodo.nome === "personalizado" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Início do período"
            value={de}
            onChange={(evento) => mudarData("de", evento.target.value)}
            className={ESTILO_DE_CAMPO}
          />
          <span className="text-sm font-bold text-black/40">até</span>
          <input
            type="date"
            aria-label="Fim do período"
            value={ate}
            onChange={(evento) => mudarData("ate", evento.target.value)}
            className={ESTILO_DE_CAMPO}
          />
        </div>
      )}

      <select
        aria-label="Clínica"
        value={clinicaId === null ? "todas" : String(clinicaId)}
        onChange={(evento) =>
          navegar({
            clinica:
              evento.target.value === "todas" ? null : evento.target.value,
          })
        }
        className={ESTILO_DE_CAMPO}
      >
        <option value="todas">Todas as clínicas</option>
        {clinicas.map((clinica) => (
          <option key={clinica.id} value={clinica.id}>
            {clinica.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
