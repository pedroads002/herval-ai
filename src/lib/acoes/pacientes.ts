"use server";

/**
 * As gravações da tela de Pacientes.
 *
 * Tudo grava em `leads`, a mesma tabela do Funil, do Atendimento e da Agenda —
 * por isso cada ação revalida aquelas telas também. Trocar a etapa passa por
 * `moverEtapaDoLead`, o mesmo caminho do Funil: entra no histórico do lead,
 * assinado por quem está logado.
 *
 * Toda ação confere sessão, autorização e a liberação da tela de Pacientes
 * antes de tocar no banco: uma ação de servidor é um endereço POST como outro
 * qualquer, e esconder o botão não impede ninguém de chamá-la. O isolamento
 * entre clínicas continua sendo do RLS.
 */

import { revalidatePath } from "next/cache";
import { exigirSessao, moverEtapaDoLead, type Sessao } from "@/lib/acoes/etapaDoLead";
import {
  carregarAutorizacao,
  ehHervalAdmin,
  PAPEIS,
  TELAS_CONTROLAVEIS,
  telaPermitidaParaColaborador,
  type Autorizacao,
} from "@/lib/autorizacao";
import { conferirMovimento } from "@/lib/dados/linhaDoFunil";
import {
  lerEmPaginas,
  lerFiltros,
  montarFiltroDeBusca,
} from "@/lib/dados/pacientes";
import {
  agruparDuplicados,
  chaveDoTelefone,
  conferirEdicao,
  conferirLinhaImportada,
  formatarTelefone,
  TETO_DA_IMPORTACAO,
  TETO_DO_LOTE,
  type GrupoDeDuplicados,
  type LinhaExportada,
  type LinhaImportada,
} from "@/lib/dados/linhaDePaciente";
import { ETAPA_GANHA } from "@/data/leads";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

type Acesso = { sessao: Sessao; autorizacao: Autorizacao };

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(mensagem: string): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now() };
}

async function exigirAcesso(): Promise<{ erro: string } | Acesso> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return sessao;

  const autorizacao = await carregarAutorizacao();
  if (
    !autorizacao ||
    !telaPermitidaParaColaborador(autorizacao, TELAS_CONTROLAVEIS.PACIENTES)
  ) {
    return { erro: "Seu acesso não inclui a tela de Pacientes." };
  }

  return { sessao, autorizacao };
}

function podeExcluir(autorizacao: Autorizacao) {
  return (
    ehHervalAdmin(autorizacao) || autorizacao.papel === PAPEIS.CLIENTE_ADMIN
  );
}

/** Ids que a tela mandou, conferidos: inteiros, positivos, sem repetição. */
function conferirIds(ids: unknown): number[] | null {
  if (!Array.isArray(ids)) return null;
  const limpos = [...new Set(ids)].filter(
    (id): id is number => Number.isInteger(id) && (id as number) > 0,
  );
  if (limpos.length === 0 || limpos.length !== ids.length) return null;
  return limpos;
}

/** A mesma base aparece em outras telas; todas precisam reler. */
function revalidarTelas(leadIds: number[] = []) {
  revalidatePath("/pacientes");
  revalidatePath("/funil");
  revalidatePath("/agenda");
  revalidatePath("/atendimento");
  for (const id of leadIds) revalidatePath(`/atendimento/${id}`);
}

// ---------------------------------------------------------------------------
// Editar
// ---------------------------------------------------------------------------

export async function editarPaciente(
  leadId: number,
  nome: string,
  telefone: string,
  especialidadeId: number | null,
): Promise<ResultadoDoCadastro> {
  const acesso = await exigirAcesso();
  if ("erro" in acesso) return recusar(acesso.erro);

  if (!Number.isInteger(leadId) || leadId <= 0) {
    return recusar("Não deu para saber qual paciente editar.");
  }

  const edicao = conferirEdicao(
    String(nome ?? ""),
    String(telefone ?? ""),
    especialidadeId,
  );
  if ("erro" in edicao) return recusar(edicao.erro);

  const { data, error } = await acesso.sessao.supabase
    .from("leads")
    .update({
      nome: edicao.nome,
      telefone: edicao.telefone,
      especialidade_interesse_id: edicao.especialidadeId,
    })
    .eq("id", leadId)
    .select("id");

  if (error) {
    // `leads_clinica_telefone_unico`: o número já é de outro paciente.
    if (error.code === "23505") {
      return recusar(
        `Já existe outro paciente com o telefone ${formatarTelefone(edicao.telefone)} nesta clínica.`,
      );
    }
    return recusar(`Não deu para salvar: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return recusar("Esse paciente não existe mais, ou não é da sua clínica.");
  }

  revalidarTelas([leadId]);
  return aceitar("Informações do paciente salvas.");
}

// ---------------------------------------------------------------------------
// Alterar etapa em lote
// ---------------------------------------------------------------------------

/**
 * A troca de etapa de vários pacientes de uma vez. Cada um passa pelo mesmo
 * `moverEtapaDoLead` do Funil, um por um, para cada movimento entrar no
 * histórico daquele paciente.
 *
 * Venda Ganha fica de fora: ela pede a venda de cada paciente (valor e
 * procedimento), e isso não se preenche em lote. A troca individual, pelo menu
 * de três pontos, abre o registro da venda.
 */
export async function moverPacientesDeEtapa(
  ids: number[],
  destino: string,
  motivoPerda: string | null,
): Promise<ResultadoDoCadastro> {
  const acesso = await exigirAcesso();
  if ("erro" in acesso) return recusar(acesso.erro);

  const leadIds = conferirIds(ids);
  if (!leadIds) return recusar("Selecione pelo menos um paciente.");
  if (leadIds.length > TETO_DO_LOTE) {
    return recusar(`Dá para mover até ${TETO_DO_LOTE} pacientes de cada vez.`);
  }
  if (destino === ETAPA_GANHA) {
    return recusar(
      "Venda Ganha pede a venda de cada paciente. Use o menu do paciente para registrar.",
    );
  }

  const movimento = conferirMovimento(leadIds[0], destino, motivoPerda);
  if ("erro" in movimento) return recusar(movimento.erro);

  const falhas: string[] = [];
  for (const id of leadIds) {
    const aviso = await moverEtapaDoLead(
      acesso.sessao,
      id,
      movimento.etapa,
      movimento.motivo,
    );
    if (aviso !== null) falhas.push(aviso);
  }

  revalidarTelas(leadIds);

  const movidos = leadIds.length - falhas.length;
  if (falhas.length > 0) {
    return recusar(
      `${movidos} de ${leadIds.length} movidos para "${movimento.etapa}". ${falhas[0]}`,
    );
  }
  return aceitar(
    movidos === 1
      ? `Paciente movido para "${movimento.etapa}".`
      : `${movidos} pacientes movidos para "${movimento.etapa}".`,
  );
}

// ---------------------------------------------------------------------------
// Excluir
// ---------------------------------------------------------------------------

/**
 * Exclui de vez. O banco apaga junto, em cascata, tudo o que é do paciente:
 * mensagens, agendamentos, vendas, notas, tarefas, mídias e o histórico de
 * etapas. Não há lixeira.
 *
 * Só Herval e admin da clínica: a tela esconde o botão do colaborador, esta
 * conferência recusa o pedido, e a política de DELETE do banco é a terceira
 * tranca (ver `supabase/pacientes.sql`).
 */
export async function excluirPacientes(ids: number[]): Promise<ResultadoDoCadastro> {
  const acesso = await exigirAcesso();
  if ("erro" in acesso) return recusar(acesso.erro);

  if (!podeExcluir(acesso.autorizacao)) {
    return recusar("Só o administrador da clínica pode excluir pacientes.");
  }

  const leadIds = conferirIds(ids);
  if (!leadIds) return recusar("Selecione pelo menos um paciente.");
  if (leadIds.length > TETO_DO_LOTE) {
    return recusar(`Dá para excluir até ${TETO_DO_LOTE} pacientes de cada vez.`);
  }

  const { data, error } = await acesso.sessao.supabase
    .from("leads")
    .delete()
    .in("id", leadIds)
    .select("id");

  if (error) return recusar(`Não deu para excluir: ${error.message}`);

  const excluidos = data?.length ?? 0;
  revalidarTelas();

  if (excluidos === 0) {
    return recusar(
      "Nenhum paciente foi excluído. Eles podem já ter sido apagados, ou não ser da sua clínica.",
    );
  }
  if (excluidos < leadIds.length) {
    return recusar(
      `${excluidos} de ${leadIds.length} pacientes excluídos. Os outros não foram encontrados na sua clínica.`,
    );
  }
  return aceitar(
    excluidos === 1 ? "Paciente excluído." : `${excluidos} pacientes excluídos.`,
  );
}

// ---------------------------------------------------------------------------
// Importar
// ---------------------------------------------------------------------------

export type ResultadoDaImportacao = ResultadoDoCadastro & {
  criados?: number;
  jaExistiam?: number;
};

/**
 * Cria os pacientes que a prévia aprovou. Quem já existe na clínica com o
 * mesmo telefone não é tocado — nem o nome, nem a etapa: importar não deve
 * desfazer o trabalho de quem já atendeu aquele paciente.
 *
 * A clínica vem da sessão para quem é cliente; só a Herval escolhe.
 */
export async function importarPacientes(
  clinicaId: number,
  linhas: LinhaImportada[],
): Promise<ResultadoDaImportacao> {
  const acesso = await exigirAcesso();
  if ("erro" in acesso) return recusar(acesso.erro);

  const escolhida = ehHervalAdmin(acesso.autorizacao)
    ? clinicaId
    : acesso.autorizacao.operacaoId;
  if (
    typeof escolhida !== "number" ||
    !Number.isInteger(escolhida) ||
    escolhida <= 0
  ) {
    return recusar("Escolha a clínica que vai receber os pacientes.");
  }
  const destino: number = escolhida;

  if (!Array.isArray(linhas) || linhas.length === 0) {
    return recusar("O arquivo não tem nenhum paciente válido para importar.");
  }
  if (linhas.length > TETO_DA_IMPORTACAO) {
    return recusar(
      `Dá para importar até ${TETO_DA_IMPORTACAO} pacientes de cada vez. Divida o arquivo.`,
    );
  }

  const conferidas = linhas.map(conferirLinhaImportada);
  if (conferidas.some((linha) => linha === null)) {
    return recusar("Alguma linha do arquivo mudou depois da prévia. Abra o arquivo de novo.");
  }

  // O banco só barra o mesmo texto de telefone. O mesmo número com e sem o
  // nono dígito passaria, e o paciente viraria dois — a chave pega esse caso.
  const existentes = await lerEmPaginas<{ telefone: string | null }>((de, ate) =>
    acesso.sessao.supabase
      .from("leads")
      .select("telefone")
      .eq("clinica_id", destino)
      .order("id", { ascending: true })
      .range(de, ate),
  );
  if (existentes.erro) {
    return recusar(`Não deu para conferir quem já existe: ${existentes.erro}`);
  }
  const chavesExistentes = new Set(
    existentes.linhas
      .map((linha) => chaveDoTelefone(linha.telefone ?? ""))
      .filter((chave): chave is string => chave !== null),
  );

  const novas = (conferidas as LinhaImportada[]).filter(
    (linha) => !chavesExistentes.has(chaveDoTelefone(linha.telefone) ?? ""),
  );

  const registros = novas.map((linha) => ({
    nome: linha.nome,
    telefone: linha.telefone,
    etapa: linha.etapa,
    clinica_id: destino,
    origem: "Importação",
  }));

  let criados = 0;
  for (let i = 0; i < registros.length; i += 500) {
    const { data, error } = await acesso.sessao.supabase
      .from("leads")
      .upsert(registros.slice(i, i + 500), {
        onConflict: "clinica_id,telefone",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      revalidarTelas();
      return recusar(
        criados > 0
          ? `${criados} pacientes importados, e o resto parou com erro: ${error.message}`
          : `Não deu para importar: ${error.message}`,
      );
    }
    criados += data?.length ?? 0;
  }

  revalidarTelas();

  const jaExistiam = conferidas.length - criados;
  return {
    ...aceitar(
      jaExistiam > 0
        ? `${criados} pacientes importados. ${jaExistiam} já estavam cadastrados nesta clínica e não foram alterados.`
        : `${criados} pacientes importados.`,
    ),
    criados,
    jaExistiam,
  };
}

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------

export type ResultadoDaExportacao =
  | { ok: true; linhas: LinhaExportada[]; cortado: boolean }
  | { ok: false; mensagem: string };

/** Todos os pacientes do filtro atual, em todas as páginas. */
export async function exportarPacientes(parametros: {
  cliente?: string;
  etapa?: string;
  busca?: string;
}): Promise<ResultadoDaExportacao> {
  const acesso = await exigirAcesso();
  if ("erro" in acesso) return { ok: false, mensagem: acesso.erro };

  const filtros = lerFiltros(
    {
      cliente: parametros?.cliente,
      etapa: parametros?.etapa,
      busca: parametros?.busca,
    },
    acesso.autorizacao,
  );
  const supabase = acesso.sessao.supabase;
  const filtroDeBusca = montarFiltroDeBusca(filtros.busca);

  type Linha = {
    nome: string | null;
    telefone: string | null;
    etapa: string;
    clinica_id: number | null;
    especialidade_interesse_id: number | null;
    criado_em: string;
    motivo_perda: string | null;
  };

  const [leitura, clientes, procedimentos] = await Promise.all([
    lerEmPaginas<Linha>((de, ate) => {
      let consulta = supabase
        .from("leads")
        .select(
          "nome, telefone, etapa, clinica_id, especialidade_interesse_id, criado_em, motivo_perda",
        );
      if (filtros.clienteId !== null) consulta = consulta.eq("clinica_id", filtros.clienteId);
      if (filtros.etapa !== null) consulta = consulta.eq("etapa", filtros.etapa);
      if (filtroDeBusca) consulta = consulta.or(filtroDeBusca);
      return consulta
        .order("nome", { ascending: true })
        .order("id", { ascending: true })
        .range(de, ate);
    }),
    supabase.from("clinicas").select("id, nome").limit(1000),
    supabase.from("especialidades").select("id, nome").limit(1000),
  ]);

  if (leitura.erro) {
    return { ok: false, mensagem: `Não deu para exportar: ${leitura.erro}` };
  }

  const nomeDoCliente = new Map(
    ((clientes.data ?? []) as { id: number; nome: string | null }[]).map((c) => [
      c.id,
      (c.nome ?? "").trim(),
    ]),
  );
  const nomeDoProcedimento = new Map(
    ((procedimentos.data ?? []) as { id: number; nome: string | null }[]).map(
      (p) => [p.id, (p.nome ?? "").trim()],
    ),
  );

  return {
    ok: true,
    cortado: leitura.cortado,
    linhas: leitura.linhas.map((linha) => ({
      nome: (linha.nome ?? "").trim(),
      telefone: (linha.telefone ?? "").trim(),
      etapa: linha.etapa,
      cliente:
        linha.clinica_id === null ? null : (nomeDoCliente.get(linha.clinica_id) ?? null),
      procedimento:
        linha.especialidade_interesse_id === null
          ? null
          : (nomeDoProcedimento.get(linha.especialidade_interesse_id) ?? null),
      criadoEm: linha.criado_em,
      motivoPerda: linha.motivo_perda,
    })),
  };
}

// ---------------------------------------------------------------------------
// Duplicados
// ---------------------------------------------------------------------------

export type ResultadoDosDuplicados =
  | { ok: true; grupos: GrupoDeDuplicados[]; cortado: boolean }
  | { ok: false; mensagem: string };

/**
 * Procura, na base inteira do recorte de cliente (sem etapa nem busca), quem
 * parece ser a mesma pessoa. Ver `agruparDuplicados`.
 */
export async function buscarDuplicados(
  cliente: string | null,
): Promise<ResultadoDosDuplicados> {
  const acesso = await exigirAcesso();
  if ("erro" in acesso) return { ok: false, mensagem: acesso.erro };

  const { clienteId } = lerFiltros(
    { cliente: cliente ?? undefined },
    acesso.autorizacao,
  );
  const supabase = acesso.sessao.supabase;

  type Linha = {
    id: number;
    nome: string | null;
    telefone: string | null;
    etapa: string;
    criado_em: string;
    clinica_id: number | null;
  };

  const [leitura, clientes] = await Promise.all([
    lerEmPaginas<Linha>((de, ate) => {
      let consulta = supabase
        .from("leads")
        .select("id, nome, telefone, etapa, criado_em, clinica_id");
      if (clienteId !== null) consulta = consulta.eq("clinica_id", clienteId);
      return consulta.order("id", { ascending: true }).range(de, ate);
    }),
    supabase.from("clinicas").select("id, nome").limit(1000),
  ]);

  if (leitura.erro) {
    return { ok: false, mensagem: `Não deu para procurar duplicados: ${leitura.erro}` };
  }

  const nomeDoCliente = new Map(
    ((clientes.data ?? []) as { id: number; nome: string | null }[]).map((c) => [
      c.id,
      (c.nome ?? "").trim(),
    ]),
  );

  return {
    ok: true,
    cortado: leitura.cortado,
    grupos: agruparDuplicados(
      leitura.linhas.map((linha) => ({
        id: linha.id,
        nome: (linha.nome ?? "").trim() || "Paciente sem nome",
        telefone: (linha.telefone ?? "").trim(),
        etapa: linha.etapa,
        criadoEm: linha.criado_em,
        clinicaId: linha.clinica_id,
        cliente:
          linha.clinica_id === null
            ? null
            : (nomeDoCliente.get(linha.clinica_id) ?? null),
      })),
    ),
  };
}
