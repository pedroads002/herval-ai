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

      <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
        {integracoes.map(({ id, nome, descricao, status, detalhe, Icone }) => {
          const conectado = status === "Conectado";

          return (
            <div
              key={id}
              className="flex flex-col rounded-card border border-black/10 bg-herval-branco p-8 shadow-card transition-colors hover:border-herval-verde/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-controle ${
                    conectado
                      ? "bg-herval-verde text-herval-preto"
                      : "bg-black/5 text-black/60"
                  }`}
                >
                  <Icone className="h-5 w-5" />
                </div>
                <Etiqueta
                  texto={status}
                  tom={conectado ? "verde" : "contorno"}
                />
              </div>

              <h2 className="mt-6 text-lg font-extrabold tracking-tight text-herval-preto">
                {nome}
              </h2>
              <p className="mt-2 text-sm font-medium text-black/60">
                {descricao}
              </p>
              <p className="mt-5 text-xs font-medium text-black/45">
                {detalhe}
              </p>

              <button
                type="button"
                className={[
                  "mt-7 w-full rounded-full px-4 py-3 text-sm font-extrabold transition-colors",
                  conectado
                    ? "border border-black/15 text-herval-preto hover:border-herval-preto hover:bg-black/5"
                    : "bg-herval-verde text-herval-preto hover:bg-herval-verdeEscuro",
                ].join(" ")}
              >
                {conectado ? "Gerenciar" : "Conectar"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
