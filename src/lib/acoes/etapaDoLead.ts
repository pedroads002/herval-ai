/**
 * A mudança de etapa do lead, num lugar só.
 *
 * Duas telas movem o mesmo lead: a Agenda move sozinha, pelo desfecho da
 * consulta (compareceu avança, faltou volta para remarcação), e o Funil move à
 * mão, pelo menu do card. Enquanto isso morava dentro de `acoes/agenda.ts`, a
 * segunda tela teria que repetir a gravação da etapa, o registro no histórico e
 * a limpeza do motivo da perda — e regra repetida é regra que passa a valer só
 * onde alguém lembrou de repetir.
 *
 * Mora fora de um arquivo `"use server"` pelo mesmo motivo de
 * `expedienteDaConsulta.ts`: ali só função assíncrona pode ser exportada, e todo
 * export vira endereço chamável de fora. Aqui há tipo e constante, e nada disto
 * deve virar endpoint — quem expõe são os arquivos de ação que importam daqui.
 *
 * Roda apenas no servidor.
 */

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { carregarPerfil } from "@/lib/perfil";
import { ETAPA_PERDIDA, type EtapaFunil, type MotivoPerda } from "@/data/leads";

type ClienteDoServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

export type Sessao = {
  supabase: ClienteDoServidor;
  usuarioId: string;
  usuarioNome: string;
};

/**
 * Sessão mais nome de quem está logado. O nome vem junto porque toda mudança de
 * etapa é assinada, e a política do banco exige que a assinatura seja a de quem
 * está gravando.
 *
 * A conferência de sessão precisa estar dentro da ação, e não só no proxy: uma
 * ação de servidor é um endereço POST como outro qualquer, e o proxy protege a
 * *tela*.
 */
export async function exigirSessao(): Promise<{ erro: string } | Sessao> {
  if (!supabaseConfigurado()) {
    return { erro: "O Supabase não está configurado neste ambiente." };
  }

  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { erro: "Sua sessão expirou. Entre de novo para gravar." };
  }

  const perfil = await carregarPerfil();

  return {
    supabase,
    usuarioId: data.user.id,
    usuarioNome: perfil?.nomeCompleto || data.user.email || "Equipe",
  };
}

/**
 * Move o lead de etapa e registra quem moveu.
 *
 * Devolve um aviso em português quando algo não pôde ser gravado, e `null`
 * quando deu tudo certo — nunca lança. Quem chama daqui da Agenda já gravou a
 * consulta antes, e dizer "não deu para marcar" depois de marcar seria mentira.
 *
 * O motivo da perda entra e sai junto com a etapa: só "Venda Perdida" guarda
 * motivo, e sair dela limpa o campo. Sem essa limpeza o lead que voltou a ser
 * atendido continuaria carregando o selo preto de perdido pelo funil inteiro.
 */
export async function moverEtapaDoLead(
  sessao: Sessao,
  leadId: number,
  destino: EtapaFunil,
  motivoPerda: MotivoPerda | null = null,
): Promise<string | null> {
  const { data: lead, error: erroDaLeitura } = await sessao.supabase
    .from("leads")
    .select("etapa, motivo_perda")
    .eq("id", leadId)
    .maybeSingle();

  if (erroDaLeitura || !lead) {
    return "A etapa do lead no Funil não foi atualizada.";
  }

  const motivoNovo = destino === ETAPA_PERDIDA ? motivoPerda : null;

  // Nada mudou: nem a etapa, nem o motivo. Gravar aqui só sujaria o histórico
  // com uma linha que não conta nenhuma mudança.
  if (lead.etapa === destino && (lead.motivo_perda ?? null) === motivoNovo) {
    return null;
  }

  const { error: erroDaEtapa } = await sessao.supabase
    .from("leads")
    .update({ etapa: destino, motivo_perda: motivoNovo })
    .eq("id", leadId);

  if (erroDaEtapa) {
    return `A etapa do lead no Funil continua em "${lead.etapa}": ${erroDaEtapa.message}`;
  }

  // Etapa igual e motivo diferente é correção de motivo, não movimento: não
  // vira linha de histórico, que é um registro de "saiu de onde e foi para
  // onde".
  if (lead.etapa === destino) return null;

  const { error: erroDoHistorico } = await sessao.supabase
    .from("lead_etapa_eventos")
    .insert({
      lead_id: leadId,
      de_etapa: lead.etapa,
      para_etapa: destino,
      autor_id: sessao.usuarioId,
      autor_nome: sessao.usuarioNome,
    });

  // A etapa mudou e o histórico não registrou. Vale avisar, porque quem for
  // conferir depois vai ver uma etapa que ninguém aparentemente mudou.
  if (erroDoHistorico) {
    return `O lead foi para "${destino}", mas a mudança não entrou no histórico.`;
  }

  return null;
}
