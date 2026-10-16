import { Users } from "lucide-react";
import Etiqueta from "@/components/Etiqueta";
import { Cartao } from "@/components/cadastro/comuns";
import { PAPEIS } from "@/lib/autorizacao";
import type { MembroDaEquipe } from "@/lib/dados/equipe";
import PermissoesDoColaborador from "@/components/PermissoesDoColaborador";

const ROTULO_DO_PAPEL = {
  [PAPEIS.CLIENTE_ADMIN]: "Admin",
  [PAPEIS.CLIENTE_OPERACIONAL]: "Colaborador",
} as const;

/**
 * Quem já tem acesso ao painel desta clínica.
 *
 * Componente de servidor — só lê o que `carregarEquipe` já trouxe, sem estado
 * nem evento próprio. `você` existe para a própria pessoa se reconhecer na
 * lista sem precisar comparar e-mail.
 *
 * Só colaborador (`cliente_operacional`) ganha o controle de telas
 * (`PermissoesDoColaborador`) — `cliente_admin` nunca é restringido por tela
 * (ver `telaPermitidaParaColaborador`), então não haveria o que configurar
 * nessa linha.
 */
export default function ListaDeEquipe({
  membros,
  idDeQuemEstaLogado,
}: {
  membros: MembroDaEquipe[];
  idDeQuemEstaLogado: string;
}) {
  return (
    <Cartao titulo="Quem tem acesso">
      {membros.length === 0 ? (
        <p className="flex items-center gap-2.5 text-sm font-medium text-black/55">
          <Users className="h-4 w-4 shrink-0 text-black/35" />
          Nenhum acesso ativo encontrado.
        </p>
      ) : (
        <ul className="divide-y divide-black/10">
          {membros.map((membro) => (
            <li
              key={membro.usuarioId}
              className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-herval-preto">
                    {membro.nome}
                    {membro.usuarioId === idDeQuemEstaLogado && (
                      <span className="ml-1.5 font-medium text-black/40">
                        (você)
                      </span>
                    )}
                  </p>
                  {membro.email && (
                    <p className="truncate text-xs font-medium text-black/45">
                      {membro.email}
                    </p>
                  )}
                </div>
                <Etiqueta
                  texto={ROTULO_DO_PAPEL[membro.papel] ?? membro.papel}
                  tom={membro.papel === PAPEIS.CLIENTE_ADMIN ? "verde" : "contorno"}
                />
              </div>

              {membro.papel === PAPEIS.CLIENTE_OPERACIONAL && (
                <PermissoesDoColaborador
                  usuarioId={membro.usuarioId}
                  telasPermitidas={membro.telasPermitidas}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
