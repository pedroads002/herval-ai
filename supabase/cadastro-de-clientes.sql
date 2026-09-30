-- ============================================================================
-- Herval AI · cadastro de clientes
--
-- >>> JÁ EXECUTADO no banco em 29/09/2026, como migration
-- >>> `cadastro_de_clientes_campos`. Este arquivo é o registro do que foi
-- >>> rodado, não uma pendência. É repetível.
-- ============================================================================
--
-- Só ACRESCENTA colunas. Nenhuma tabela criada, nenhuma coluna alterada ou
-- removida, nenhuma linha tocada. As telas que já liam `clinicas` e
-- `profissionais` continuam lendo exatamente o que liam.
--
-- O que NÃO foi criado, de propósito:
--
--   uma tabela de "procedimentos"   já existe: é `especialidades`, e o vínculo
--                                   por profissional já existe em
--                                   `profissional_especialidades`. Criar outra
--                                   deixaria o sistema com dois catálogos.
--   `profissionais.clinica_id`      a pessoa já pertence ao cliente através da
--                                   unidade onde atende
--                                   (`profissional_unidades` -> `unidades` ->
--                                   `clinicas`). Uma segunda ligação para o
--                                   mesmo fato é uma ligação a mais para
--                                   discordar da primeira.
--   uma coluna `business_name`      seria `nome` com outro nome.
--
-- Consequência de não ter `clinica_id`, que o código precisa cobrir: apagar um
-- cliente NÃO apaga os profissionais dele por cascade. `excluirCliente`, em
-- `src/lib/acoes/profissionais.ts`, apaga as pessoas antes. Sem isso elas
-- ficariam soltas no cadastro, sem cliente nenhum.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. O cliente
--
-- `tipo_operacao` é a resposta da primeira pergunta do cadastro. Nasce como
-- 'equipe' porque é o que os clientes já cadastrados eram antes desta coluna
-- existir — quem atende sozinho passou a ser dito explicitamente a partir daqui.
--
-- `cidade` e `endereco` já existiam e não foram tocadas.
-- ----------------------------------------------------------------------------
alter table public.clinicas
  add column if not exists tipo_operacao text not null default 'equipe',
  add column if not exists nome_exibicao text,
  add column if not exists responsavel_principal text,
  add column if not exists area_atuacao text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists instagram text,
  add column if not exists estado text,
  add column if not exists descricao text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinicas_tipo_operacao_check') then
    alter table public.clinicas
      add constraint clinicas_tipo_operacao_check
      check (tipo_operacao in ('individual', 'equipe'));
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 2. O profissional
--
-- `procedimento_outro` guarda o procedimento que não estava na lista, em texto
-- solto. Não vira linha em `especialidades` de propósito: catálogo alimentado
-- por digitação de formulário enche de variações da mesma coisa ("Botox",
-- "botox", "Toxina botulínica") e aí ninguém mais consegue contar quantos
-- profissionais fazem aquilo.
--
-- A coluna `tipo` continua obrigatória e travada nos dezessete cargos. Ela é
-- preenchida com a área de atuação do cliente: quem atende numa clínica de
-- odontologia é da área de odontologia, e perguntar isso pessoa por pessoa
-- seria pedir a mesma resposta várias vezes.
-- ----------------------------------------------------------------------------
alter table public.profissionais
  add column if not exists nome_exibicao text,
  add column if not exists especialidade_principal text,
  add column if not exists procedimento_outro text;
