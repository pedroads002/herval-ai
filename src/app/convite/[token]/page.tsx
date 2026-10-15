import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import LogoHerval from "@/components/LogoHerval";
import Rodape from "@/components/Rodape";
import FormularioDeConvite from "@/components/FormularioDeConvite";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Concluir cadastro · Herval AI",
};

/**
 * A tela de quem abre o link do convite — sem sessão nenhuma, de propósito:
 * é exatamente quem ainda não tem conta.
 *
 * A leitura usa a `service_role` porque não existe outro jeito de ler esta
 * clínica aqui: RLS exige `operacao_do_usuario()`, e essa pessoa ainda não é
 * o usuário de operação nenhuma. A rota confere o convite inteiro (expirado,
 * já usado, tentativas) de novo no POST — esta leitura só decide se mostra o
 * formulário ou o aviso de link inválido, nunca autoriza nada por si só.
 */
export default async function PaginaDoConvite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valido = await convitePendente(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <LogoHerval className="h-24 w-24 rounded-card p-2.5" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-herval-preto">
              {valido ? `Bem-vindo${valido.nome ? `, ${valido.nome}` : ""}` : "Herval AI"}
            </h1>
            <p className="mt-1 text-sm font-medium text-black/55">
              {valido
                ? "Complete o cadastro para ganhar acesso ao painel."
                : "Convite não encontrado."}
            </p>
          </div>
        </div>

        <div className="rounded-card bg-herval-branco p-7 shadow-card">
          {valido ? (
            <FormularioDeConvite token={token} />
          ) : (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm font-bold text-herval-preto">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Este link não é mais válido
              </p>
              <p className="text-sm leading-relaxed text-black/65">
                Ele pode ter expirado, já ter sido usado, ou o endereço está
                incompleto. Peça um novo convite para quem cuida da sua conta
                na Herval.
              </p>
            </div>
          )}
        </div>

        <Rodape className="mt-4" />
      </div>
    </main>
  );
}

async function convitePendente(token: string) {
  if (token.trim() === "") return null;

  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) return null;

  const { data } = await clienteAdmin
    .from("convites")
    .select("usado_em, expira_em, clinicas(nome)")
    .eq("token", token)
    .maybeSingle();

  if (!data || data.usado_em !== null) return null;
  if (new Date(data.expira_em).getTime() <= Date.now()) return null;

  const clinica = Array.isArray(data.clinicas) ? data.clinicas[0] : data.clinicas;
  return { nome: (clinica as { nome?: string } | null)?.nome ?? "" };
}
