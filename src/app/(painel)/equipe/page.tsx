import Cabecalho from "@/components/Cabecalho";
import ListaDeEquipe from "@/components/ListaDeEquipe";
import ConvidarColaborador from "@/components/ConvidarColaborador";
import { exigirClienteAdmin } from "@/lib/autorizacao";
import { carregarEquipe } from "@/lib/dados/equipe";

/**
 * A Equipe: quem tem acesso ao painel desta clínica, e o convite para trazer
 * mais gente — sem precisar pedir para a Herval.
 *
 * Só `cliente_admin` abre esta tela (ver `exigirClienteAdmin`). A clínica
 * nunca vem da URL nem de formulário: é sempre `autorizacao.operacaoId`, a da
 * própria sessão — a mesma garantia que impede uma clínica de ver a equipe de
 * outra.
 *
 * Sem `export const dynamic`, pelo mesmo motivo das outras telas do painel: a
 * leitura passa pelo cliente do Supabase, que lê os cookies da sessão, e isso
 * já torna a página dinâmica.
 */
export default async function PaginaEquipe() {
  const autorizacao = await exigirClienteAdmin();

  // `exigirClienteAdmin` só deixa passar quem já tem `operacaoId` — papel
  // cliente_admin sempre tem clínica, nunca é null.
  const clinicaId = autorizacao.operacaoId as number;

  const { membros, falha } = await carregarEquipe(clinicaId);

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Equipe"
        descricao="Quem tem acesso ao painel da sua clínica, e o convite para trazer mais gente."
      />

      {falha ? (
        <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
          <p className="text-sm font-medium text-black/60">{falha}</p>
        </div>
      ) : (
        <ListaDeEquipe
          membros={membros}
          idDeQuemEstaLogado={autorizacao.usuarioId}
        />
      )}

      <ConvidarColaborador />
    </div>
  );
}
