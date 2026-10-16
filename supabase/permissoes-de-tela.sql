-- Permissões de tela — quais das telas opcionais cada colaborador abre.
--
-- `autorizacoes` já sabe QUEM é a pessoa e de qual clínica. Esta coluna
-- acrescenta uma terceira pergunta, só relevante para `cliente_operacional`:
-- destas quatro telas que não são Visão Geral — Leads (funil), Conversas
-- (atendimento), Relatórios e Agenda —, quais o cliente_admin da clínica
-- liberou para esta pessoa?
--
-- Decisões do desenho:
--
-- 1. `telas_permitidas is null` é "sem restrição configurada" — todo
--    colaborador de hoje, e todo colaborador novo, até alguém mexer nisso em
--    Equipe. Null não é "nenhuma tela"; é "todas". Vetor vazio (`'{}'`) É
--    "nenhuma tela além de Visão Geral", de propósito — as duas coisas
--    continuam distintas, e o código (`telaPermitidaParaColaborador`, em
--    `src/lib/autorizacao.ts`) depende dessa distinção.
--
-- 2. A coluna existe para TODO papel, não só `cliente_operacional` — o CHECK
--    abaixo não sabe de papel, só de conteúdo. Quem decide que ela só vale
--    para colaborador é o código (a mesma função de cima): `herval_admin` e
--    `cliente_admin` nunca são restringidos por aqui, mesmo que a linha tenha
--    valor. É mais simples que uma segunda tabela só para evitar um valor que
--    o código já ignora.
--
-- 3. Quem escreve aqui é sempre a `service_role`, pela rota
--    `/api/admin/equipe/permissoes` — a mesma razão de `convites` e
--    `provisionar-cliente` não terem política de escrita para
--    `authenticated`: a tabela já concede só SELECT da própria linha, e isso
--    não muda agora. Um `cliente_admin` precisa editar a linha de OUTRA
--    pessoa (a do colaborador), o que a política de hoje nunca permitiria
--    mesmo que quisesse.
--
-- Idempotente: pode rodar mais de uma vez sem quebrar nada.

alter table public.autorizacoes
  add column if not exists telas_permitidas text[];

alter table public.autorizacoes
  drop constraint if exists autorizacoes_telas_da_lista;

alter table public.autorizacoes
  add constraint autorizacoes_telas_da_lista check (
    telas_permitidas is null
    or telas_permitidas <@ array['funil', 'atendimento', 'relatorios', 'agenda']
  );
