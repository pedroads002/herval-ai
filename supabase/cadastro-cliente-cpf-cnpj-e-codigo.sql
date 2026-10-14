-- Fase 6 — Cadastro self-service do cliente.
--
-- cpf_cnpj já estava aplicada direto no banco, sem arquivo versionado; este
-- arquivo registra as duas colunas (a antiga e a nova) para o histórico não
-- ficar órfão. `if not exists` porque cpf_cnpj já existe em produção.
alter table public.clinicas add column if not exists cpf_cnpj text;

create unique index if not exists clinicas_cpf_cnpj_key
  on public.clinicas (cpf_cnpj)
  where cpf_cnpj is not null;

-- codigo_acesso é quem realmente autoriza o cadastro — cpf_cnpj só identifica
-- a clínica. CPF/CNPJ está na Receita, em nota fiscal, no Google: sozinho não
-- prova relação com a clínica, e deixar que prove dá a quem souber o
-- documento acesso de cliente_admin às conversas e mídia dos pacientes dela
-- (as mesmas que #75/#76 trancaram contra qualquer um fora da operação). O
-- código é gerado pela Herval e passado ao cliente por fora (telefone,
-- e-mail do contrato) — isso sim prova relação.
alter table public.clinicas add column if not exists codigo_acesso text;

create unique index if not exists clinicas_codigo_acesso_key
  on public.clinicas (codigo_acesso)
  where codigo_acesso is not null;
