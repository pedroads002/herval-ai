/**
 * Cadastro self-service antigo — DESATIVADO.
 *
 * Este caminho (URL fixa `/cadastro`, CPF/CNPJ + um código de acesso único
 * por clínica, gravado em texto puro em `clinicas.codigo_acesso`) foi
 * substituído pelo fluxo de convite com link (ver `src/lib/convites.ts`,
 * `src/app/api/admin/convidar-cliente/route.ts` e
 * `src/app/api/convite/completar/route.ts`): a Herval gera um link por
 * cliente, de uso único e com expiração, e o código de acesso vira o segundo
 * fator daquele link — não mais uma senha compartilhada por clínica.
 *
 * A coluna `clinicas.codigo_acesso` que esta rota usava foi removida pela
 * migração `supabase/convites.sql`. Por isso a rota responde 410 em vez de
 * tentar ler uma coluna que não existe mais — nada aqui deveria estar
 * recebendo tráfego real (os clientes de teste ainda não tinham sido
 * convidados por este caminho), mas um 500 por coluna inexistente seria pior
 * que uma recusa clara.
 */
export async function POST() {
  return Response.json(
    {
      ok: false,
      motivo:
        "Este link de cadastro não é mais usado. Peça à Herval um novo convite.",
    },
    { status: 410 },
  );
}
