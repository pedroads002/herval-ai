"use client";

import { useRouter } from "next/navigation";
import type { ClinicaDaLista } from "@/lib/dados/visaoGeral";

/**
 * De qual cliente são os templates que a tela mostra.
 *
 * A escolha vai para o endereço (`?clinica=38`), e não para estado do React,
 * pelo mesmo motivo da Visão Geral: quem lê o banco é o servidor, e guardar a
 * escolha só no navegador obrigaria a tela a filtrar memória. De brinde, o
 * endereço fica compartilhável.
 *
 * Aqui não existe "Todas as clínicas", diferente da Visão Geral: template é de
 * um cliente (o índice de template ativo é por clínica e categoria), então
 * "todos" não seria uma lista para ler nem para editar — seria uma pergunta
 * sem resposta.
 */

const ESTILO_DE_CAMPO =
  "rounded-controle border border-black/15 bg-herval-branco px-3.5 py-2.5 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

export default function SeletorDeCliente({
  clinicas,
  clinicaId,
}: {
  clinicas: ClinicaDaLista[];
  clinicaId: number | null;
}) {
  const router = useRouter();

  return (
    <label className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-black/45">
      Cliente
      <select
        value={clinicaId === null ? "" : String(clinicaId)}
        onChange={(evento) => {
          const escolha = evento.target.value;
          router.push(
            escolha === ""
              ? "/templates-whatsapp"
              : `/templates-whatsapp?clinica=${escolha}`,
          );
        }}
        className={ESTILO_DE_CAMPO}
      >
        <option value="">Escolha um cliente</option>
        {clinicas.map((clinica) => (
          <option key={clinica.id} value={clinica.id}>
            {clinica.nome}
            {/* Mesma marca dos seletores da Visão Geral e dos Relatórios,
                palavra por palavra: é a mesma lista nas três telas. */}
            {clinica.ativa ? "" : " (pausada)"}
          </option>
        ))}
      </select>
    </label>
  );
}
