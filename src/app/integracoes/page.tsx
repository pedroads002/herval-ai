import Cabecalho from "@/components/Cabecalho";
import Etiqueta from "@/components/Etiqueta";
import { Kanban, MessageCircle, Megaphone } from "lucide-react";

const integracoes = [
  {
    id: "kommo",
    nome: "Kommo",
    descricao: "CRM onde ficam os leads e os funis de venda.",
    status: "Conectado" as const,
    detalhe: "Última sincronização: hoje às 09h42",
    Icone: Kanban,
  },
  {
    id: "whatsapp",
    nome: "WhatsApp",
    descricao: "Canal de conversa com os leads e pacientes.",
    status: "Pendente" as const,
    detalhe: "Aguardando confirmação do número",
    Icone: MessageCircle,
  },
  {
    id: "meta-ads",
    nome: "Meta Ads",
    descricao: "Campanhas de anúncios no Facebook e Instagram.",
    status: "Conectado" as const,
    detalhe: "3 campanhas ativas",
    Icone: Megaphone,
  },
];

export default function PaginaIntegracoes() {
  return (
    <>
      <Cabecalho
        titulo="Integrações"
        descricao="Situação das conexões com os sistemas externos."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {integracoes.map(({ id, nome, descricao, status, detalhe, Icone }) => (
          <div
            key={id}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-marca-clara text-marca">
                <Icone className="h-5 w-5" />
              </div>
              <Etiqueta
                texto={status}
                tom={status === "Conectado" ? "sucesso" : "atencao"}
              />
            </div>

            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {nome}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{descricao}</p>
            <p className="mt-4 text-xs text-slate-400">{detalhe}</p>

            <button
              type="button"
              className="mt-5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {status === "Conectado" ? "Gerenciar" : "Conectar"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
