"use server";

/**
 * As gravações da Agenda.
 *
 *   marcarConsulta          marca, ou remarca, a consulta de um lead.
 *   definirDesfechoDaConsulta  compareceu, faltou, cancelou.
 *
 * Grava em `agendamentos`, e move o lead de etapa quando o desfecho manda: quem
 * comparece vai para "Comparecimento", quem falta cai em "Reagendamento". A
 * mudança de etapa vira linha em `lead_etapa_eventos`, assinada por quem está
 * logado — é o mesmo histórico que o Funil mostra.
 *
 * A conferência de sessão está aqui dentro, e não só no proxy, pelo mesmo motivo
 * das outras ações: uma ação de servidor é um endereço POST como outro qualquer,
 * e o proxy protege a *tela*.
 */

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { carregarPerfil } from "@/lib/perfil";
import { statusPossiveis, type StatusDaConsulta } from "@/lib/dados/agenda";
import {
  lerConsulta,
  numeroDoCampo,
  type ConsultaGravavel,
} from "@/lib/acoes/consultaDoFormulario";
import { conferirExpediente } from "@/lib/acoes/expedienteDaConsulta";
import {
  ETAPA_AGENDADO,
  ETAPA_COMPARECEU,
  ETAPA_REMARCAR,
  type EtapaFunil,
} from "@/data/leads";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

type ClienteDoServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(mensagem: string): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now() };
}

type Sessao = {
  supabase: ClienteDoServidor;
  usuarioId: string;
  usuarioNome: string;
};

/**
 * Sessão mais nome de quem está logado. O nome vem junto porque toda mudança de
 * etapa é assinada, e a política do banco exige que a assinatura seja a de quem
 * está gravando.
 */
async function exigirSessao(): Promise<{ erro: string } | Sessao> {
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
 * As conferências que só o banco sabe responder: o lugar é do cliente do lead, e
 * a pessoa escolhida atende ali e realiza aquilo.
 *
 * A tela já só oferece combinações válidas, e é justamente por isso que isto
 * existe: se algum dia ela oferecer errado, a recusa aqui é o que impede a
 * consulta de ir para uma unidade onde o profissional não trabalha.
 */
async function conferirCombinacao(
  supabase: ClienteDoServidor,
  dados: ConsultaGravavel,
): Promise<string | null> {
  const { data: lead, error: erroDoLead } = await supabase
    .from("leads")
    .select("id, clinica_id, etapa")
    .eq("id", dados.lead_id)
    .maybeSingle();

  if (erroDoLead) return `Não deu para ler o lead: ${erroDoLead.message}`;
  if (!lead) return "Esse lead não existe mais.";

  const { data: unidade, error: erroDaUnidade } = await supabase
    .from("unidades")
    .select("id, clinica_id, nome")
    .eq("id", dados.unidade_id)
    .maybeSingle();

  if (erroDaUnidade)
    return `Não deu para ler a unidade: ${erroDaUnidade.message}`;
  if (!unidade) return "Essa unidade não existe mais.";

  if (lead.clinica_id !== null && unidade.clinica_id !== lead.clinica_id) {
    return "Essa unidade é de outro cliente. O paciente precisa ser atendido em uma unidade do cliente dele.";
  }

  if (dados.profissional_id !== null) {
    const { data: vinculo, error: erroDoVinculo } = await supabase
      .from("profissional_unidades")
      .select("profissional_id, dias_semana, hora_inicio, hora_fim")
      .eq("profissional_id", dados.profissional_id)
      .eq("unidade_id", dados.unidade_id)
      .maybeSingle();

    if (erroDoVinculo) {
      return `Não deu para conferir quem atende na unidade: ${erroDoVinculo.message}`;
    }
    if (!vinculo) {
      return `Essa pessoa não atende em ${unidade.nome}. Escolha outra unidade ou outro profissional.`;
    }

    const foraDoExpediente = conferirExpediente(vinculo, dados, unidade.nome);
    if (foraDoExpediente !== null) return foraDoExpediente;

    if (dados.especialidade_id !== null) {
      const { data: realiza, error: erroDoProcedimento } = await supabase
        .from("profissional_especialidades")
        .select("profissional_id")
        .eq("profissional_id", dados.profissional_id)
        .eq("especialidade_id", dados.especialidade_id)
        .maybeSingle();

      if (erroDoProcedimento) {
        return `Não deu para conferir quem realiza o procedimento: ${erroDoProcedimento.message}`;
      }
      if (!realiza) {
        return "Essa pessoa não realiza esse procedimento. Escolha outro profissional.";
      }
    }
  }

  return null;
}

/**
 * O horário já está ocupado por outra consulta da mesma pessoa.
 *
 * Só olha consulta em aberto: faltou, compareceu e cancelou é passado, e passado
 * não ocupa horário. E compara a hora exata, não a duração do procedimento — uma
 * consulta de 40 minutos às 14:00 não impede outra às 14:20 por enquanto.
 *
 * Sem profissional, ou sem hora, não há choque possível: a consulta ainda não
 * ocupa a agenda de ninguém, ela aparece em "Aguardando horário".
 */
async function conferirChoqueDeHorario(
  supabase: ClienteDoServidor,
  dados: ConsultaGravavel,
  idQueVaiSerRemarcada: number | null,
): Promise<string | null> {
  if (dados.profissional_id === null || dados.hora_consulta === null) {
    return null;
  }

  let busca = supabase
    .from("agendamentos")
    .select("id")
    .eq("profissional_id", dados.profissional_id)
    .eq("data_consulta", dados.data_consulta)
    .eq("hora_consulta", dados.hora_consulta)
    .eq("status", "Agendada");

  // A consulta que vai ser remarcada não choca com ela mesma.
  if (idQueVaiSerRemarcada !== null) {
    busca = busca.neq("id", idQueVaiSerRemarcada);
  }

  const { data: choque, error } = await busca.limit(1).maybeSingle();

  if (error) {
    return `Não deu para conferir se o horário está livre: ${error.message}`;
  }
  if (choque) {
    return "Esse profissional já tem consulta marcada nesse dia e hora. Escolha outro horário ou outro profissional.";
  }

  return null;
}

/**
 * Marca a consulta de um lead — ou remarca, se ele já tem uma em aberto.
 *
 * Remarcar atualiza a consulta aberta em vez de criar outra: o banco aceitaria
 * as duas, e duas consultas abertas para o mesmo lead é o tipo de coisa que
 * ninguém vê na grade e todo mundo descobre no dia. Consulta já encerrada
 * (compareceu, faltou, cancelou) não é tocada: ela é histórico.
 */
export async function marcarConsulta(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const dados = lerConsulta(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const impedimento = await conferirCombinacao(sessao.supabase, dados);
  if (impedimento !== null) return recusar(impedimento);

  const { data: aberta, error: erroDaBusca } = await sessao.supabase
    .from("agendamentos")
    .select("id")
    .eq("lead_id", dados.lead_id)
    .eq("status", "Agendada")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (erroDaBusca) {
    return recusar(
      `Não deu para conferir a consulta atual: ${erroDaBusca.message}`,
    );
  }

  const ocupado = await conferirChoqueDeHorario(
    sessao.supabase,
    dados,
    aberta?.id ?? null,
  );
  if (ocupado !== null) return recusar(ocupado);

  const { error } = aberta
    ? await sessao.supabase
        .from("agendamentos")
        .update(dados)
        .eq("id", aberta.id)
    : await sessao.supabase.from("agendamentos").insert(dados);

  if (error) {
    // O índice único do banco é a última barreira: ela pega o caso em que duas
    // pessoas marcam o mesmo horário no mesmo instante, e a conferência de cima
    // ainda tinha visto o horário livre nas duas.
    if (error.code === "23505") {
      return recusar(
        "Esse profissional acabou de receber consulta nesse mesmo dia e hora. Atualize a tela e escolha outro horário.",
      );
    }
    return recusar(`Não deu para marcar: ${error.message}`);
  }

  const aviso = await moverEtapa(sessao, dados.lead_id, ETAPA_AGENDADO);

  revalidar();
  return aceitar(
    [aberta ? "Consulta remarcada." : "Consulta marcada.", aviso]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Marca o desfecho da consulta. O lead se move de etapa sozinho conforme a
 * regra, que é a mesma de sempre: compareceu avança, faltou volta para
 * remarcação. Cancelada não move ninguém — cancelar não diz o que aconteceu com
 * o paciente, e adivinhar aqui tiraria o lead da mão de quem cancelou.
 */
export async function definirDesfechoDaConsulta(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numeroDoCampo(formData, "id");
  const status = String(formData.get("status") ?? "");

  if (id === null) return recusar("Não deu para saber qual consulta mudar.");
  if (!(statusPossiveis as string[]).includes(status)) {
    return recusar("Esse desfecho não existe.");
  }

  const desfecho = status as StatusDaConsulta;

  const { data: consulta, error: erroDaLeitura } = await sessao.supabase
    .from("agendamentos")
    .select("id, lead_id")
    .eq("id", id)
    .maybeSingle();

  if (erroDaLeitura) {
    return recusar(`Não deu para ler a consulta: ${erroDaLeitura.message}`);
  }
  if (!consulta) return recusar("Essa consulta não existe mais.");

  const { error } = await sessao.supabase
    .from("agendamentos")
    .update({ status: desfecho })
    .eq("id", id);

  if (error) return recusar(`Não deu para gravar o desfecho: ${error.message}`);

  const destino = etapaDoDesfecho(desfecho);
  const aviso =
    destino === null
      ? null
      : await moverEtapa(sessao, consulta.lead_id, destino);

  revalidar();
  return aceitar(
    [`Marcado como "${desfecho}".`, aviso].filter(Boolean).join(" "),
  );
}

/** Para onde o sistema move o lead quando a consulta muda de desfecho. */
function etapaDoDesfecho(status: StatusDaConsulta): EtapaFunil | null {
  if (status === "Compareceu") return ETAPA_COMPARECEU;
  if (status === "Faltou") return ETAPA_REMARCAR;
  if (status === "Agendada") return ETAPA_AGENDADO;
  return null;
}

/**
 * Move o lead de etapa e registra quem moveu. Devolve um aviso quando a etapa
 * não pôde ser gravada — e nunca derruba a ação: a consulta já está gravada, e
 * dizer "não deu para marcar" depois de marcar seria mentira.
 */
async function moverEtapa(
  sessao: Sessao,
  leadId: number,
  destino: EtapaFunil,
): Promise<string | null> {
  const { data: lead, error: erroDaLeitura } = await sessao.supabase
    .from("leads")
    .select("etapa")
    .eq("id", leadId)
    .maybeSingle();

  if (erroDaLeitura || !lead) {
    return "A etapa do lead no Funil não foi atualizada.";
  }
  if (lead.etapa === destino) return null;

  const { error: erroDaEtapa } = await sessao.supabase
    .from("leads")
    .update({ etapa: destino })
    .eq("id", leadId);

  if (erroDaEtapa) {
    return `A etapa do lead no Funil continua em "${lead.etapa}": ${erroDaEtapa.message}`;
  }

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

function revalidar() {
  revalidatePath("/agenda");
  // A etapa do lead mudou, e ela é o que o Funil desenha.
  revalidatePath("/funil");
}
