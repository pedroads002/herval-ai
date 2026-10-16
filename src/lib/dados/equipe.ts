/**
 * A equipe de uma clínica: quem, além do contato principal, tem acesso ao
 * painel dela.
 *
 * Lê pela chave `service_role`, e não pela sessão do próprio usuário — de
 * propósito, e é a mesma pergunta que `lib/supabase/admin.ts` pede para
 * responder antes de importar dali: por que a sessão não basta? Porque a
 * política de `autorizacoes` e `profiles` só deixa cada um ler a própria
 * linha (`auth.uid() = usuario_id` / `auth.uid() = id`), e é exatamente isso
 * que falta aqui — um `cliente_admin` enxergando as linhas dos colegas da
 * própria clínica, não a dele. A tranca de quem pode chamar isto não mora
 * aqui: é a página (`exigirClienteAdmin`) que só deixa entrar quem tem esse
 * papel, e só passa a própria `clinica_id` — nunca a de outra clínica.
 *
 * Roda apenas no servidor.
 */
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { PAPEIS, TELAS_CONTROLAVEIS, type TelaControlavel } from "@/lib/autorizacao";

/**
 * Só os dois papéis que esta lista mostra. `herval_admin` nunca tem
 * `clinica_id`, então nunca aparece numa busca por `clinica_id` — mas o tipo
 * de `Papel` inclui ele, e deixar esse terceiro valor entrar aqui obrigaria
 * quem lê esta lista a tratar um caso que não existe de verdade.
 */
export type PapelDeCliente =
  | typeof PAPEIS.CLIENTE_ADMIN
  | typeof PAPEIS.CLIENTE_OPERACIONAL;

export type MembroDaEquipe = {
  usuarioId: string;
  nome: string;
  email: string;
  papel: PapelDeCliente;
  criadoEm: string;
  /**
   * Só tem efeito para `cliente_operacional` (ver `telaPermitidaParaColaborador`
   * em `src/lib/autorizacao.ts`). `null` é "sem restrição configurada" — vê as
   * quatro telas opcionais, igual a hoje.
   */
  telasPermitidas: TelaControlavel[] | null;
};

export type DadosDaEquipe = {
  membros: MembroDaEquipe[];
  falha: string | null;
};

const SEM_DADOS: DadosDaEquipe = { membros: [], falha: null };

const TELAS_VALIDAS = new Set<string>(Object.values(TELAS_CONTROLAVEIS));

/** Mesma defesa de `telasPermitidasValidas` em `autorizacao.ts`: nunca confia
 * no formato bruto que vem do banco. */
function telasValidas(bruto: unknown): TelaControlavel[] | null {
  if (!Array.isArray(bruto)) return null;
  return bruto.filter(
    (valor): valor is TelaControlavel =>
      typeof valor === "string" && TELAS_VALIDAS.has(valor),
  );
}

export async function carregarEquipe(clinicaId: number): Promise<DadosDaEquipe> {
  if (!supabaseConfigurado()) {
    return {
      ...SEM_DADOS,
      falha: "O Supabase não está configurado neste ambiente.",
    };
  }

  const admin = criarClienteAdmin();
  if (!admin) {
    return {
      ...SEM_DADOS,
      falha:
        "Listagem de equipe não está configurada neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  // Só quem está com acesso ligado: linha desativada não é equipe, é
  // histórico, e não é isso que esta tela promete mostrar.
  const { data: linhas, error } = await admin
    .from("autorizacoes")
    .select("usuario_id, papel, criado_em, telas_permitidas")
    .eq("clinica_id", clinicaId)
    .eq("ativo", true)
    .order("criado_em", { ascending: true });

  if (error) {
    return { ...SEM_DADOS, falha: `Não deu para ler a equipe: ${error.message}` };
  }

  const linhasValidas = (linhas ?? []).filter(
    (linha): linha is typeof linha & { papel: PapelDeCliente } =>
      linha.papel === PAPEIS.CLIENTE_ADMIN ||
      linha.papel === PAPEIS.CLIENTE_OPERACIONAL,
  );

  if (linhasValidas.length === 0) return SEM_DADOS;

  const ids = linhasValidas.map((linha) => linha.usuario_id);

  const { data: perfis, error: erroDosPerfis } = await admin
    .from("profiles")
    .select("id, nome, sobrenome, email")
    .in("id", ids);

  if (erroDosPerfis) {
    return {
      ...SEM_DADOS,
      falha: `Não deu para ler a equipe: ${erroDosPerfis.message}`,
    };
  }

  const perfilPorId = new Map(
    (perfis ?? []).map((perfil) => [perfil.id as string, perfil]),
  );

  const membros: MembroDaEquipe[] = linhasValidas.map((linha) => {
    const perfil = perfilPorId.get(linha.usuario_id);
    const nome = [perfil?.nome, perfil?.sobrenome]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      usuarioId: linha.usuario_id,
      nome: nome || perfil?.email || "Sem nome",
      email: perfil?.email ?? "",
      papel: linha.papel,
      criadoEm: linha.criado_em,
      telasPermitidas: telasValidas(linha.telas_permitidas),
    };
  });

  return { membros, falha: null };
}
