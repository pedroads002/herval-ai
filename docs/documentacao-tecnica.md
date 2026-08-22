# Helô - Herval AI — Documentação Técnica da Fundação de Dados

**Escopo deste documento:** modelo de dado, regras de negócio e convenções criadas durante a construção da seção Relatórios (Funil Geral + Fila de Atendimento) e da unificação de dados que a sustenta. Cobre a branch `relatorios-funil-geral`.

**Fora de escopo:** integração de IA real, APIs, RAG, memória de conversa, ou qualquer parte da execução automática da Helô enquanto agente conversacional. Este documento descreve a fundação de dados e as regras de negócio sobre as quais essa integração vai ser construída — não a integração em si.

---

## 1. Por que este documento existe

Ao longo da construção, várias decisões de negócio não-óbvias foram tomadas — o que qualifica um lead, o que dispara um alerta, o que é dado real versus dado gerado para demonstração. Essas decisões vivem espalhadas em commits e numa conversa longa. Este documento consolida o que uma pessoa nova no projeto precisa saber antes de mexer na base ou integrar algo novo, para não quebrar regras sem perceber.

---

## 2. Modelo de dado

### 2.1 Clínicas (`clinicas.ts`)
Cadastro próprio — são os clientes da agência, não uma unidade física isolada. Campos: nome, cidade, número de unidades (pode ser zero — uma clínica pode não ter unidade física própria), ativa/inativa.

### 2.2 Leads
Dois arquivos, mesmo formato, universos diferentes:

- **`leads.ts`** — a fila viva. Hoje 74 leads, os mesmos que a Fila de Tarefas e o Funil (Kanban) exibem no dia a dia.
- **`leadsHistoricos.ts`** — 2.936 leads sintéticos, gerados para dar profundidade histórica aos Relatórios. Cobrem ~4 meses de safras anteriores.

Campos: `id`, `clinicaId`, `etapa`, `origem`, `diasAtras` (data relativa, não fixa). **Não existe campo `qualificado` gravado** — é sempre calculado (ver seção 3.4). Os leads históricos **não têm nome nem telefone** — só existem para alimentar métrica agregada, não são acionáveis individualmente.

IDs não colidem entre os dois arquivos (fila: 1–74, histórico: a partir de 1001) — é seguro tratar como um universo só quando necessário.

### 2.3 Agendamentos (`agendamentos.ts`)
Fonte única de verdade para tudo relacionado a consulta/agendamento — Agenda, Funil e Relatórios leem todos daqui. Entidade separada do lead, um lead pode ter vários agendamentos (histórico de remarcações).

Campos: `leadId`, data do ato de agendar, data da consulta, status (`Agendada` / `Compareceu` / `Faltou` / `Cancelada`), quem fechou (IA-automático ou humano), orçamento/valor, e (migrados de um campo antigo já removido) `profissionalId`, `especialidadeId`, `hora`, `confirmada`.

Total atual: 705 agendamentos. A maioria sem `profissionalId`/`hora` (só os que vieram originalmente da Agenda têm esse detalhe) — **isso é intencional**, não se inventou dado que não existia.

> Havia um campo antigo (`Tarefa.consulta`, tipo `ConsultaMarcada`) que duplicava parte dessa informação especificamente para a tela de Agenda. Foi **removido**, não só descontinuado — a Agenda também lê de `agendamentos.ts` hoje.

### 2.4 Etapas do Funil (Kanban)
16 etapas, nesta ordem exata (definidas em `leads.ts`, `etapasFunil`):

`Leads Recebidos → Em Contato → Outros Contatos → F1 → F2 → F3 → F4 → F5 → F6 → F7 → Nutrição → Agendamento → Reagendamento → Comparecimento → Venda Ganha` / **`Venda Perdida`**

`Venda Ganha` e `Venda Perdida` são estados terminais.

### 2.5 Histórico de mudança de etapa (`historicoEtapas.ts`)
Todo lead grava um registro a cada troca de etapa — não existia antes, foi criado especificamente para permitir medir tempo de resposta. Formato compacto: uma linha por lead, com trincas `[etapa, minutosAtras, agente]` (id e etapa-anterior são deriváveis da posição, não gravados de novo).

`agente` é `{ tipo: "IA" | "Automática" | "Humano", nome? }`. Movimentação manual grava o nome do usuário autenticado (via `perfil.ts`/Supabase); eventos automáticos gravam `"Automática"`; ação da IA grava `"IA"`.

Total: 14.152 mudanças em 3.010 leads (média 4,7 por lead).

### 2.6 Histórico de mensagens (`EventoHistorico`, dentro de `tarefas.ts`)
**Correção (confirmada pelo Claude Code lendo o código em 18/08):** este documento originalmente dizia que `EventoHistorico` fica dentro de `leads.ts`. Está errado — o campo vive em `tarefas.ts:38`, é campo de `Tarefa`, não de `Lead`. Isso importa: como `Tarefa` é a fila viva, o histórico de mensagens **só existe para os 74 leads da fila** — nenhum dos 2.936 leads históricos tem mensagem registrada, porque nunca tiveram uma `Tarefa`. Qualquer tela nova que precise abrir a conversa de um lead qualquer (não só da fila) esbarra nisso como decisão de arquitetura.

Log de mensagens que a IA enviou ao lead — **não é histórico de conversa**, não registra resposta do lead nem ligação. Campos: `quando` (minutos atrás — era texto fixo tipo `"10/03 14:33"`, foi convertido), `mensagem`, `regra`. Existe só para os 74 leads da fila (135 eventos). Cada mensagem está ancorada no evento de etapa que a regra dela cita (ex: "Lembrete 24h" ancora na entrada em `Agendamento`; "Venda fechada" ancora em `Venda Ganha`).

### 2.7 Metas (`metas.ts`)
Todo parâmetro numérico usado em regra de negócio ou alerta vive aqui — não fixo em código. Inclui: meta de agendamento sobre qualificados (25%), teto de cancelamento (15%), piso de show-rate (70%), e os parâmetros do alerta de cauda (`multiplicadorDaCauda: 2`, `caudaCritica: 3`, `minimoNaCauda: 3`).

### 2.8 Camada de cálculo (`relatorios.ts`, `lib/atendimento.ts`, `lib/tempo.ts`)
- `relatorios.ts` — funções compartilhadas entre Relatórios e Visão Geral (funil de marketing, produção, follow, funil de conversão). As duas telas leem das mesmas funções — não há lógica duplicada.
- `lib/atendimento.ts` — regra central de tempo de resposta: `ETAPA_PRIMEIRO_CONTATO`, `minutosAteOPrimeiroContato` (retorna `null`, não zero, para quem ainda não foi contatado), `tempoDeResposta` (média, mediana, atendidos, aguardando), `faixasDeResposta` (as faixas/buckets de espera, fonte única para distribuição e alertas).
- `lib/tempo.ts` — convenção de tempo relativo em minutos (`MINUTOS_POR_DIA` liga a escala de dias usada no resto da base com a escala de minutos usada aqui).

---

## 3. Regras de negócio centrais

### 3.1 Movimentação de etapa
Por padrão, o sistema move o lead sozinho, a partir de evento real de agendamento:
- Agendamento marcado `Compareceu` → etapa vira `Comparecimento`.
- Agendamento marcado `Faltou` → etapa vira `Reagendamento`, automaticamente.
- Novo agendamento criado para um lead em `Reagendamento` → etapa volta para `Agendamento`, com nota de remarcação e contador.

O CRC pode mover qualquer lead para qualquer etapa manualmente, a qualquer momento — isso nunca é bloqueado. Justificativa é opcional, **exceto**:
- **Venda Ganha** — exige valor da venda (campo numérico, sem opção de forma de pagamento).
- **Venda Perdida** — exige motivo, escolhido de lista fechada (não texto livre).

### 3.2 Os 9 motivos de perda
`Clicou errado`, `Convênio`, `Localização distante`, `Perdeu o interesse`, `Fechou em outra clínica`, `Não atende o procedimento`, `Sem dinheiro`, `Spam`, `Outros`.

Três deles **desqualificam retroativamente** o lead (o lead nunca foi um prospect real): `Clicou errado`, `Não atende o procedimento`, `Spam`. Os outros seis mantêm o lead como qualificado mesmo perdido — era um prospect real que não fechou por outro motivo (incluindo `Localização distante`, que foi deliberadamente excluído da lista de desqualificantes: alguém longe pode fazer avaliação online e se deslocar pontualmente, não é o mesmo que nunca ter sido um lead viável).

`Spam`, especificamente, é para conteúdo sem sentido/sem interação real — **não** para lead que parou de responder após conversa real (isso é `Perdeu o interesse`).

### 3.3 Qualificado (função `ehQualificado`, não campo gravado)
- Se o lead está em `Venda Perdida`: olha o motivo (ver 3.2).
- Qualquer outro lead: `true` a partir do momento em que passa de `Em Contato` para `Outros Contatos` ou além. Antes disso, `false`.

### 3.4 Primeiro contato e tempo de resposta
Definição oficial: primeiro contato = primeira mudança de etapa para `Em Contato`. Por regra da régua de automação (fora deste documento), essa transição é **sempre atribuída a agente Humano** — a IA nunca faz o primeiro contato.

**Mediana é a métrica principal** de tempo de resposta, não a média — a média é facilmente distorcida por uma cauda pequena de casos extremos (verificado na base real: 6h de média contra 8min de mediana, com 67% dos leads contatados em até 30 minutos). Onde a tela mostra tempo de resposta, o padrão é: mediana em destaque, média + causa da cauda como legenda de contexto.

### 3.5 Pontos de atenção (dois motores de alerta)
**Funil Geral:** por clínica — cancelamento acima do teto, show-rate abaixo do piso, taxa de agendamento sobre qualificados abaixo da meta. Piso de volume mínimo (5 agendamentos) evita alarme de amostra pequena. Severidade (crítico/atenção) por distância da meta.

**Fila de Atendimento:** dois gatilhos —
1. Lead individual parado em `Leads Recebidos` há mais de 1 dia sem contato.
2. Clínica cuja fatia de leads na cauda de espera (12h–1 dia + mais de 1 dia) é pelo menos o dobro da fatia da base inteira no mesmo período, com no mínimo 3 leads na cauda (evita que 1 caso isolado dispare alerta crítico por percentual).

Nenhum alerta em nenhuma das duas telas menciona "CS" — o projeto não tem esse time, só CRC.

---

## 4. O que é dado real vs. gerado para demonstração

| Fonte | Natureza |
|---|---|
| `leads.ts` (74 leads da fila) | Base viva, é o que o sistema usa operacionalmente hoje |
| `leadsHistoricos.ts` (2.936) | Sintético, gerado para dar profundidade aos Relatórios |
| `agendamentos.ts` (maioria dos 705) | Majoritariamente sintético, gerado para acompanhar o histórico |
| `historicoEtapas.ts` (14.152 registros) | Sintético, gerado para os históricos; real (capturado ao vivo) para a fila |
| `fake-supabase.js` | Stub de autenticação para desenvolvimento — **não é integração real com Supabase** |

Toda data no sistema é relativa ("há X dias/minutos"), calculada em tempo de execução — não fixa. Isso é intencional, para a base de demonstração não envelhecer, mas significa que qualquer integração real vai substituir esses campos por timestamps absolutos de verdade.

---

## 5. Pendências conhecidas (nenhuma bloqueante)

- **Meta de 25%** (taxa de agendamento sobre qualificados) precisa de recalibração — a definição de qualificado mudou duas vezes desde que essa meta foi fixada. Decisão do usuário, ainda não tomada.
- **Nome da aba "Fila de Atendimento"** — discussão pausada a pedido explícito do usuário, não fechada.
- **Toggle "mostrar só leads identificados"** nos Pontos de atenção da Fila de Atendimento — sugerido, não implementado. Os alertas de lead parado sobre a base histórica não têm nome/telefone acionável (ver 2.2).
- **Arredondamento cosmético**: a distribuição de tempo de espera soma 102% em vez de 100% (arredondamento por faixa) — contagens exatas, só exibição.
- **Tabela "ação por agente"** — propositalmente adiada até o time de CRC crescer além de 1–2 pessoas.
- **Auditoria visual formal** — Funil (Kanban), Agenda e a Visão Geral reconstruída nunca passaram por uma revisão visual dedicada (contraste, espaçamento, responsividade) como a que foi feita em Relatórios. Recomendado antes de considerar a fundação "pronta para entrega".

---

## 6. Onde este documento termina

Tudo acima é sobre a camada de dados e regras de negócio — o "esqueleto" que qualquer integração futura (IA, WhatsApp, RAG, memória de conversa) vai precisar respeitar e alimentar. Como a IA decide o que responder, como ela mantém contexto de conversa, e como ela se conecta a APIs externas está fora do escopo deste documento e desta fase do projeto.
