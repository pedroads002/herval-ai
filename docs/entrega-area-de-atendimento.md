# Entrega — Área de Atendimento

Registro do que foi entregue na branch `area-de-atendimento`, mesclada na
`main` pelo PR #13. Este texto era a descrição do PR, que não chegou a ser
preenchida porque o merge foi feito direto.

Implementa a Área de Atendimento — o chat operacional do CRC com o lead —
em seis fases, seguindo `docs/especificacao-area-de-atendimento.md`.

As três primeiras são só dado, sem mudar tela; as três últimas constroem a
tela, a régua de ligação e a métrica que ela alimenta.

## O que cada fase entregou

**1. `mensagens.ts` — a conversa** (`67ae8fa`)
Modelo bidirecional lead↔Helô, substituindo `Tarefa.historico`/`EventoHistorico`,
que era log unidirecional preso à fila. Os 135 eventos foram migrados sem
alterar texto, regra nem horário, e o campo antigo foi removido em vez de
descontinuado.

**2. `ligacoes.ts` + `notas.ts` — telefone e anotações** (`57c5a9f`)
Histórico de tentativas de ligação por canal (discador/WhatsApp) e notas
internas como lista rastreável, com autor e horário. Inclui a geração do lado
do lead na conversa, coerente com o que cada uma já mostrava.

**3. `clinicas.ts` enriquecido** (`cb11f7b`)
Ficha própria por clínica — estratégia, comercial, público-alvo e
procedimentos com valor por clínica — e vínculo profissional↔clínica
(`clinicaIds`). Encerra a duplicação em que `estrategia.ts` guardava uma ficha
só para doze clientes e o catálogo guardava um preço só para todas.

**4. Tela de Atendimento** (`492b356`)
Layout de três colunas e quatro abas (Agenda, Ligações, Clínica, Log),
acessível pelo card do lead no Funil. Sem lista nova: o ponto de entrada é o
card que já existia.

**5. Motor das 6 tentativas** (`47b0e01`)
A régua de ligação em `lib/regua.ts`, painel "Ligar" em três passos, e a
mensagem automática de retomada com a queda para F1 — tudo visível na tela
quando acontece, nada em silêncio. Funciona sem agendador: o que fecha a
sequência é o próprio CRC registrando a tentativa.

**6. Fila de Atendimento v1 revisada** (`636965b`)
O tempo de resposta passa a ser medido da chegada até a primeira tentativa de
ligação. Volume e tempo de resposta passaram a sair de bases diferentes, e a
paridade de Recebidos e Agendados com os Relatórios está preservada e
verificada nos cinco períodos.

## Verificação

**175 invariantes, todos passando:** 24 da base + 25 (fase 2) + 32 (fase 3) +
20 (fase 4) + 30 (fase 5) + 44 (fase 6). Cada fase foi testada ao vivo no
navegador antes de ser commitada.

## Pendências conhecidas, não bloqueantes

- **Estouro da barra lateral no mobile.** A barra é `fixed w-56` e não recolhe
  em nenhuma largura, então o Funil já estourava antes desta branch. Fica para
  uma auditoria visual futura.
- **`preview_start` pelo nome da configuração** segue quebrado, por um motivo
  sem relação com este código. Os testes foram feitos subindo o servidor pelo
  terminal.
