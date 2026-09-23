# Helô - Herval AI — Especificação: O Cérebro (n8n) — Fase 1, MVP Conversacional

**Contexto:** o painel (este repositório) hoje só guarda dado e regra de negócio — não existe nada que decida o que a Helô responde. Este documento especifica a primeira fatia do "cérebro": um workflow em n8n que recebe uma mensagem de um lead, monta o contexto certo, chama a IA (Claude, via API da Anthropic) e devolve uma resposta — testável isoladamente, sem depender de WhatsApp real ainda.

**Fora de escopo aqui:** WhatsApp Business API real, telefonia, e a régua completa de mensagens automáticas (retomada em T+8h etc. — ver `docs/especificacao-area-de-atendimento.md`, seção 5.1). Este documento cobre só o núcleo de decisão: dado um lead e uma mensagem nova, o que a Helô responde.

---

## 1. Princípio de arquitetura: separar canal de raciocínio

O motivo de o MVP não usar WhatsApp real desde já não é só reduzir risco — é uma escolha de desenho. O workflow é dividido em duas partes que não deveriam saber uma da outra:

- **Entrada/saída (canal):** hoje um Webhook de teste; depois, o webhook do WhatsApp Business. Troca-se sem tocar no resto.
- **Raciocínio (o cérebro de fato):** busca contexto, decide se a IA pode falar, monta o prompt, chama o Claude, grava a conversa. Isso não muda quando o canal mudar.

Essa separação é a mesma lógica de "fonte única" que já rege o resto do projeto (agendamento sempre em `agendamentos.ts`, etapa sempre derivada, nunca duplicada) — aqui aplicada ao transporte da mensagem.

---

## 2. As três travas que vêm antes de qualquer resposta da IA

Estas não são detalhes de implementação — são regras de negócio já fechadas em outros documentos, e o workflow **falha na sua função se não aplicar as três, nesta ordem**, antes de gerar qualquer texto:

### 2.1 Modo de atendimento da clínica
Lido de `clinicas.modo_atendimento`. Se `Pausada` ou `Só humano`: a IA não responde — a mensagem do lead é só registrada e o CRC assume. Se `Só marketing`: só responde leads de origem de campanha. Caso contrário (`Todo lead`), segue.

### 2.2 A IA nunca faz o primeiro contato
Regra confirmada na documentação técnica (seção 3.4) e no cenário "Lead novo pedindo preço" do Teste da IA (`src/data/testeIa.ts`): o primeiro contato com um lead é **sempre** humano. Na prática: se este lead ainda não tem nenhuma linha em `mensagens`, o workflow **não gera resposta de IA** — só grava a mensagem recebida e sinaliza para o CRC assumir manualmente. A IA só entra na conversa depois que um humano já abriu.

### 2.3 Especialidade pausada
Se o lead está associado a uma especialidade com `ativa = false` (ou pergunta por uma), a IA não oferece nem agenda — usa o texto de `como_abordar_pausada` daquela especialidade e sinaliza a equipe. Ver cenário "Pergunta sobre especialidade pausada" no simulador.

Só depois dessas três travas o workflow monta o prompt e chama a IA.

---

## 3. Desenho do workflow (nós, em ordem)

```
[Webhook: nova mensagem]
        │  { leadId, texto, formato }
        ▼
[Buscar contexto no Supabase]
   lead + clínica + especialidade de interesse
   + últimas N mensagens do lead + objeções
        │
        ▼
[Guarda 1: modo de atendimento] ──(Pausada/Só humano)──▶ [Gravar mensagem do lead] ──▶ fim
        │ (Todo lead / Só marketing ok)
        ▼
[Guarda 2: é o primeiro contato?] ──(sim)──▶ [Gravar mensagem do lead + sinalizar CRC] ──▶ fim
        │ (não, já existe conversa)
        ▼
[Guarda 3: especialidade pausada?] ──(sim)──▶ [Responder com texto fixo + sinalizar] ──▶ [Gravar os dois lados] ──▶ fim
        │ (não)
        ▼
[Montar prompt]
   system prompt fixo (persona + regras) + ficha da clínica +
   especialidades ativas e valores + objeções + histórico + mensagem nova
        │
        ▼
[Chamar Claude — api.anthropic.com/v1/messages]
        │
        ▼
[Gravar os dois lados em `mensagens`]
   (a mensagem do lead que chegou + a resposta da IA)
        │
        ▼
[Responder no Webhook] — devolve o texto gerado, para o teste
```

Cada retângulo é um node (ou pequeno grupo de nodes) no n8n. Os três losangos de guarda são nodes `IF`/`Switch`.

### 3.1 Node a node

1. **Webhook (trigger).** Método POST, recebe `{ leadId, texto, formato }`. No MVP, disparado manualmente (Postman, ou o próprio "Listen for test event" do n8n) — é o "lead mandou mensagem", simulado.
2. **Buscar contexto.** Um node Supabase (ou HTTP Request contra a REST API do Supabase) por tabela: `leads` (join `clinicas` e `especialidades`), `mensagens` (últimas ~20 do lead, ordenadas), `objecoes` (a lista inteira — é pequena), `clinica_especialidades` (para valores).
3. **Guarda 1 — modo de atendimento** (seção 2.1).
4. **Guarda 2 — primeiro contato** (seção 2.2): `count(mensagens where lead_id = X) === 0`.
5. **Guarda 3 — especialidade pausada** (seção 2.3).
6. **Montar prompt** — um node `Code` (JavaScript) que monta o array de mensagens para a API da Claude: um `system` fixo (ver seção 4) e o histórico como turnos `user`/`assistant` alternados, terminando na mensagem nova do lead.
7. **Chamar Claude** — `HTTP Request` para `https://api.anthropic.com/v1/messages`, header `x-api-key` vindo de uma credencial do n8n (nunca hardcoded no node), modelo Claude, `max_tokens` moderado (respostas de WhatsApp são curtas).
8. **Gravar em `mensagens`** — duas linhas: a mensagem do lead (`remetente_tipo: 'Lead'`) e a resposta (`remetente_tipo: 'IA'`).
9. **Responder no Webhook** — devolve `{ resposta: "..." }` para quem chamou (nesta fase, você testando).

### 3.2 Tratamento de erro
Se a chamada à Claude falhar (rede, limite, etc.): não deixar o lead sem resposta em silêncio. Node de erro captura a falha, grava uma nota interna sinalizando o CRC (reaproveitando o conceito de "sinalizar equipe" já usado nas guardas 2 e 3), e não inventa uma resposta.

---

## 4. O prompt de sistema — o que fixa a personalidade e as regras

O `system prompt` é o lugar que carrega:

- **Persona:** tom da Helô — o mesmo tom que já aparece nos exemplos do Teste da IA (direto, sem se auto-apresentar toda hora, foco em avançar a conversa para agendamento).
- **Regras que não podem ser violadas mesmo se o lead insistir:**
  - Nunca oferecer nem "quase confirmar" uma especialidade com `ativa = false`.
  - Nunca inventar valor: se não houver linha em `clinica_especialidades` para aquele procedimento naquela clínica, dizer que vai confirmar com a equipe — nunca chutar um número.
  - Nunca se apresentar como se estivesse fazendo o primeiro contato (isso já foi filtrado pela Guarda 2, mas o prompt reforça o tom de "continuando a conversa").
  - Ao encontrar uma objeção reconhecível, preferir a resposta já cadastrada em `objecoes` ao invés de inventar uma nova.
- **Conteúdo dinâmico:** ficha da clínica inteira (história, diferenciais, comercial, público-alvo, endereço, horário) e a lista de especialidades ativas com valor, montados a partir do que a Guarda buscou — nunca fixos no prompt.

Este prompt é o artefato que vai precisar de mais iteração depois de rodar os testes da seção 5 — é normal ajustá-lo várias vezes até o tom bater com o que a equipe espera.

---

## 5. Como testar antes de confiar

`src/data/testeIa.ts` já tem 4 cenários pensados exatamente para isto — não são texto esperado palavra por palavra (são roteiro fixo para referência de tom), mas servem como roteiro de teste manual: dado o mesmo histórico e a mesma pergunta, a resposta do workflow real deve respeitar as mesmas regras que o roteiro respeita (parcelamento quando perguntam de preço, recusa educada de especialidade pausada, nunca fazer primeiro contato). Rodar os 4 cenários contra o webhook antes de considerar o MVP pronto.

---

## 6. O que fica para a Fase 2 (fora deste documento)

- Trocar o Webhook de teste pelo webhook real do WhatsApp Business.
- A régua completa de mensagens automáticas (retomada em T+8h, mudança de etapa por mensagem) — já especificada em `docs/especificacao-area-de-atendimento.md`, seção 5.1, mas ainda não implementada no cérebro.
- Migrar o restante do modelo de dado (agendamentos, histórico de etapas, ligações) para o Supabase, hoje ainda em `src/data/`.
- Ligar o painel (Next.js) para ler destas tabelas novas em vez dos arquivos fixos — este documento só cobre o lado do n8n/Supabase; o painel continua lendo dado fixo até essa migração acontecer à parte.

---

## 7. Pré-requisitos para construir isto

- Projeto Supabase já existente (`hkmehycruprsqprwgeco`) com as tabelas de `supabase/cerebro-ia.sql` rodadas.
- Credencial da **service role key** do Supabase cadastrada no n8n (não a chave anônima do `.env.local` do painel).
- Credencial da API da Anthropic (Claude) cadastrada no n8n.
- Acesso à instância de n8n onde este workflow será criado.
