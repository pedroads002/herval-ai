-- ============================================================================
-- Herval AI · vendas do lead
--
-- Mover para "Venda Ganha" dizia que o lead fechou, mas não dizia o quê, quando
-- nem por quanto. Sem isso o painel não tem como mostrar o retorno que a Helô
-- trouxe para a clínica — que é o número que o cliente mais quer ver.
--
-- Isto reverte, de forma consciente, a decisão do #45 ("o sistema não guarda nem
-- exibe valor de nada nem de ninguém"): aquela decisão tirou preço e orçamento
-- do painel. Aqui o valor é outro — o que o paciente efetivamente pagou — e foi
-- pedido pela Herval em 24/11/2026.
--
-- Por que tabela própria, e não colunas em `leads`: o mesmo paciente compra mais
-- de uma vez (avaliação, procedimento, retorno meses depois). Com o valor no
-- lead, a segunda venda apagaria a primeira.
--
-- Campos obrigatórios: valor e procedimento. A data é opcional na tela (vem
-- preenchida com hoje) e nunca fica nula aqui: sem data, a venda não entra em
-- conta nenhuma por mês.
--
-- `clinica_id` é copiado do lead no momento da gravação por um gatilho, e não
-- confiado ao que a tela mandar: é por ele que o RLS separa uma operação da
-- outra, e a tela não decide de qual clínica é a venda.
--
-- Mesmo desenho de RLS de `isolamento-leads-mensagens.sql`: Herval vê tudo,
-- cliente vê só a própria operação. O n8n não lê nem grava aqui hoje.
-- É repetível: rodar de novo não recria nada.
-- ============================================================================

create table if not exists public.vendas (
  id               bigint generated always as identity primary key,
  lead_id          integer not null references public.leads (id) on delete cascade,
  clinica_id       integer references public.clinicas (id),
  valor            numeric(12, 2) not null check (valor > 0),
  procedimento     text not null check (length(btrim(procedimento)) between 1 and 120),
  especialidade_id integer references public.especialidades (id),
  data_venda       date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  forma_pagamento  text check (forma_pagamento is null or length(forma_pagamento) <= 60),
  parcelas         smallint check (parcelas is null or parcelas between 1 and 48),
  observacao       text check (observacao is null or length(observacao) <= 500),
  registrado_por      uuid,
  registrado_por_nome text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

comment on table public.vendas is
  'Vendas fechadas por lead (valor pago, procedimento, data). Um lead pode ter varias. Gravadas pelo painel ao mover para Venda Ganha ou em "Registrar venda".';

create index if not exists vendas_lead_id_idx on public.vendas (lead_id);
create index if not exists vendas_clinica_data_idx on public.vendas (clinica_id, data_venda);

-- A clínica da venda é sempre a do lead.
create or replace function public.vendas_clinica_do_lead()
returns trigger
language plpgsql
as $$
begin
  select l.clinica_id into new.clinica_id from public.leads l where l.id = new.lead_id;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists vendas_clinica_do_lead on public.vendas;
create trigger vendas_clinica_do_lead
  before insert or update of lead_id, valor, procedimento, especialidade_id, data_venda,
    forma_pagamento, parcelas, observacao
  on public.vendas
  for each row execute function public.vendas_clinica_do_lead();

alter table public.vendas enable row level security;

drop policy if exists "le_vendas_da_operacao" on public.vendas;
create policy "le_vendas_da_operacao"
  on public.vendas for select
  to authenticated
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

drop policy if exists "registra_venda_na_operacao" on public.vendas;
create policy "registra_venda_na_operacao"
  on public.vendas for insert
  to authenticated
  with check (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

drop policy if exists "corrige_venda_da_operacao" on public.vendas;
create policy "corrige_venda_da_operacao"
  on public.vendas for update
  to authenticated
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id))
  with check (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

-- Apagar existe para desfazer lançamento errado (venda no lead errado, valor
-- duplicado). Mesmo alcance da correção.
drop policy if exists "apaga_venda_da_operacao" on public.vendas;
create policy "apaga_venda_da_operacao"
  on public.vendas for delete
  to authenticated
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

grant select, insert, update, delete on public.vendas to authenticated;
revoke all on public.vendas from anon;
