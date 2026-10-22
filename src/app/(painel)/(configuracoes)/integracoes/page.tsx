import Cabecalho from "@/components/Cabecalho";
import Etiqueta from "@/components/Etiqueta";
import { Kanban, MessageCircle, Megaphone } from "lucide-react";
import { exigirHervalAdmin } from "@/lib/autorizacao";

/**
 * Nenhuma integração real existe ainda — nem Kommo, nem Meta Ads, nem
 * WhatsApp. Esta tela antes mostrava "Conectado" fixo para Kommo e Meta Ads,
 * com data de sincronização e contagem de campanha inventadas, e nenhum dos
 * três botões tinha ação (nem "Gerenciar", nem "Conectar"). Corrigido para
 * contar a verdade: hoje é só um status, sem nada clicável, porque não há
 * conexão nenhuma para gerenciar ainda.
 */
const integracoes = [
  {
    id: "kommo",
    nome: "Kommo",
    descricao: "CRM onde ficam os leads e os funis de venda.",
    status: "Não conectado" as const,
    detalhe: "Ainda não configurado",
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
    status: "Não conectado" as const,
    detalhe: "Ainda não configurado",
    Icone: Megaphone,
  },
];

export default async function PaginaIntegracoes() {
  // Tela exclusiva da Herval. Ver `exigirHervalAdmin`.
  await exigirHervalAdmin();

  return (
    <>
      <Cabecalho
        titulo="Integrações"
        descricao="Situação das conexões com os sistemas externos."
      />

      <p className="mb-7 rounded-controle border border-dashed border-black/20 bg-black/[0.03] px-5 py-4 text-sm font-medium text-black/60">
        Nenhuma integração está configurada ainda. Esta tela só mostra o
        status — a conexão de cada uma entra aqui assim que for configurada.
      </p>

      <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
        {integracoes.map(({ id, nome, descricao, status, detalhe, Icone }) => (
          <div
            key={id}
            className="flex flex-col rounded-card border border-black/10 bg-herval-branco p-8 shadow-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-controle bg-black/5 text-black/60">
                <Icone className="h-5 w-5" />
              </div>
              <Etiqueta texto={status} tom="contorno" />
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
              disabled
              className="mt-7 w-full cursor-not-allowed rounded-full border border-black/10 px-4 py-3 text-sm font-extrabold text-black/35"
            >
              Em breve
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
