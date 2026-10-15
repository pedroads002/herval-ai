# Handoff: Agente "Helô" — n8n + Supabase (Cowork → Claude Code)

> Cole este documento inteiro como primeira mensagem numa sessão do Claude Code para continuar o trabalho exatamente de onde parou. Todo o conteúdo abaixo foi verificado agora (21/09/2026) direto na fonte (API do n8n e Supabase via MCP), não é memória de conversa.

## 1. O que é o projeto

Agente de IA "Helô" para o CRM via WhatsApp da Herval Marketing (clínicas). Implementado como workflow n8n chamado **"Helô - base"**.

- Workflow ID: `gDP9Cy9pPeRGaRS5`
- URL: `https://n8n.hervalmarketing.com/workflow/gDP9Cy9pPeRGaRS5`
- Estado do workflow: **`active: false`** (não está publicado/em produção — nada do que foi feito até agora afetou atendimento real)
- Projeto Supabase: `helô-herval-ai` (id `hkmehycruprsqprwgeco`, região `sa-east-1`)

## 2. Escopo travado (não renegociar sem o usuário)

Construir **apenas o "caminho central"**:

Receber mensagem no WhatsApp → aplicar 3 guard rails de negócio (modo de atendimento da clínica, primeiro-contato-é-sempre-humano, especialidade-pausada) → Claude gera a resposta com a persona "Helô" → salvar a troca nas tabelas Supabase novas → responder.

**Fora de escopo nesta fase (não deletar, só manter desativado/inerte):** RAG, sub-agentes autônomos de agenda/calendário, fluxo automático de lembrete de consulta.

**Decisão explícita do usuário (contra minha recomendação, mas é a escolha dele — respeitar):** manter o node `calendar_agent2` conectado como tool do `Supervisor1`, mesmo agendamento estando fora de escopo nesta fase. Confirmado ainda conectado: `connections["calendar_agent2"].ai_tool[0][0] = {node: "Supervisor1", type: "ai_tool"}`.

## 3. Regra de segurança (inegociável)

**Nunca digitar API keys, senhas ou credenciais em nenhum campo do n8n** — nem nos botões "Connect to Supabase", "Connect to OpenAI/Anthropic", nada. O usuário cria e conecta todas as credenciais manualmente.

## 4. Por que migrar de Cowork para Claude Code

A tool de escrita automática do n8n (`mcp__n8n__update_workflow`) está bloqueada para este workflow: ela rejeita qualquer edição porque não reconhece o tipo de community node `n8n-nodes-evolution-api` usado no workflow. Isso forçou a fase anterior (Cowork) a editar tudo clicando na tela via automação de navegador — funciona, mas é lento e mais sujeito a erro de clique do que edição direta via API/arquivo.

**Recomendação para o Claude Code:** antes de tentar `update_workflow` (que provavelmente vai falhar pelo mesmo motivo), tentar escrever via chamada HTTP direta à API REST do n8n (`PUT /api/v1/workflows/{id}`, com a API key do n8n — o usuário precisa fornecer/criar essa key separadamente, não é a mesma coisa que credencial de node). Isso contorna o bloqueio da tool MCP e elimina a fonte de erro que mais preocupa o usuário (clique errado no lugar errado). Se a API também rejeitar por causa do node desconhecido, aí sim volta pra edição via tela, com o mesmo cuidado de sempre verificar via leitura (`get_workflow_details` ou API GET) depois de cada edição.

## 5. Estado atual — o que já está feito e verificado

Tudo abaixo foi reconfirmado agora lendo o JSON bruto do workflow (`mcp__n8n__get_workflow_details`), não é só relato de tela.

### 5.1 Modelo de linguagem do Supervisor1
- Node antigo `OpenAI Chat Model3` foi **substituído** (via "Replace" no n8n, que preserva a conexão automaticamente) por um novo node **`Anthropic Chat Model`** (tipo `@n8n/n8n-nodes-langchain.lmChatAnthropic`, modelo `claude-sonnet-5`).
- Conexão confirmada: `connections["Anthropic Chat Model"].ai_languageModel[0][0] = {node: "Supervisor1", type: "ai_languageModel"}`.
- **Achado e corrigido nesta sessão:** o node estava com `disabled: true` (ou seja, o Supervisor1 estava sem nenhum modelo de linguagem ativo, apesar de aparentar estar tudo certo na conexão). Reativado via right-click → Activate no canvas. Confirmado depois: `disabled: null` (ativo).
- **Ainda falta:** o usuário precisa criar a credencial Anthropic no n8n e conectá-la neste node (campo "Connect to Anthropic" — hoje está sem credencial, o que é esperado).

### 5.2 Nodes antigos desativados (não deletados)
Dentro do grupo "Histórico Supabase": `Busca Telefone1`, `If`, `Adiciona CHAT supabase1`, `Atualiza CHAT Supabase1` — todos confirmados com `disabled: true`.

### 5.3 Nodes repontados para o schema novo
- `Cria Histórico Supabase1` → tabela `mensagens`, campos mapeados: `lead_id`, `texto`, `remetente_tipo` (fixo "IA"), `formato` (fixo "texto"), `criado_em` (`$now`).
- `Pausar IA1`, `Reativar IA1`, `Buscar Cliente1`, `Criar Cliente1` → todos usando `tableId: "leads"`, todos `disabled: null` (ativos).

Todos confirmados agora, sem alteração desde a última verificação.

## 6. Schema real do Supabase (puxado agora, direto do banco)

Isso é mais confiável que qualquer spec escrita anteriormente — é o schema vivo.

**`clinicas`** (1 linha hoje): `id`, `nome`, `cidade`, `numero_unidades`, `ativa` (bool), `modo_atendimento` (text, **CHECK enum**: `'Pausada' | 'Todo lead' | 'Só marketing' | 'Só humano'`, default `'Todo lead'`), `historia`, `diferenciais`, `tratamentos_oferecidos`, `parcelamento`, `formas_pagamento`, `convenios`, `classe_economica`, `faixa_etaria`, `principais_dores`, `endereco`, `horario_funcionamento`, `instancia_whatsapp`.

→ **Guard rail "modo de atendimento da clínica"** se resolve direto neste campo `modo_atendimento`.

**`especialidades`** (3 linhas): `id`, `nome`, `ativa` (bool, default true), `duracao_minutos` (default 40), `como_abordar_pausada` (text nullable).

→ **Guard rail "especialidade-pausada"** se resolve com `especialidades.ativa = false` + usa `como_abordar_pausada` como instrução de como a Helô deve contornar o assunto.

**`clinica_especialidades`** (3 linhas, tabela de junção): `clinica_id`, `especialidade_id`, `valor` (numeric nullable). PK composta.

**`leads`** (0 linhas): `id`, `nome`, `telefone`, `clinica_id` (FK), `especialidade_interesse_id` (FK), `etapa` (default `'Leads Recebidos'`), `origem`, `criado_em`, `atendimento_ia` (text nullable — provavelmente o campo usado por Pausar IA1/Reativar IA1).

→ **Guard rail "primeiro-contato-é-sempre-humano"**: provavelmente se resolve checando se já existe uma linha em `leads` para o `telefone` recebido (lead novo = primeiro contato).

**`objecoes`** (6 linhas): `id`, `objecao`, `resposta`, `usos` (default 0). Base de respostas prontas pra objeções comuns — provavelmente insumo do contexto de negócio injetado no prompt da Helô.

**`mensagens`** (0 linhas): `id`, `lead_id` (FK), `remetente_tipo` (**CHECK enum**: `'Lead' | 'IA' | 'Automática' | 'Humano'`), `remetente_nome` (nullable), `formato` (**CHECK enum**: `'texto' | 'audio'`, default `'texto'`), `texto`, `regra` (nullable — provavelmente registra qual guard rail motivou a mensagem/ação), `status` (**CHECK enum**: `'enviada' | 'entregue' | 'lida'`, nullable), `criado_em`.

## 7. O que falta construir

**Importante — leia isto antes de começar:** numa sessão anterior (não recuperável neste handoff) eu tinha desenhado SQL/expressões exatas para os nodes abaixo, mas o texto exato dessas queries não está disponível para esta sessão (ficou só resumido, não literal). Em vez de arriscar reconstruir de memória algo que pode estar sutilmente errado, a recomendação é: **desenhar as queries do zero agora, usando o schema real da seção 6 acima**, que é a fonte da verdade atual. É mais seguro que confiar numa reconstrução aproximada.

Nodes a criar (nomes sugeridos, mantendo o padrão de nomenclatura do workflow — sufixo numérico se já existir nome igual):

1. **`Guarda 1e2 - Pode Responder`** (Postgres/Supabase, executeQuery) — combina o check de `clinicas.modo_atendimento` (bloquear se `'Pausada'` ou `'Só humano'`; considerar `'Só marketing'` conforme regra de negócio a confirmar com o usuário) com o check de primeiro-contato (existe lead com esse telefone?).
2. **`Guarda 1e2 - Verificar`** (node IF) — ramifica com base no resultado do node acima: segue pro atendimento da IA, ou desvia pro branch de bloqueio/sinalização humana.
3. **`Buscar Contexto de Negocio`** (Postgres/Supabase, executeQuery) — busca clínica + especialidades ativas/pausadas + preços (via `clinica_especialidades`) + objeções relevantes, retornando um JSON que alimenta o prompt do Supervisor1.
4. **`Salvar Mensagem do Lead`** (Supabase, create em `mensagens`) — salva a mensagem recebida do lead (`remetente_tipo: 'Lead'`) antes de gerar a resposta da IA.
5. **`Guarda 2 - Salvar e Sinalizar CRC`** (mesmo formato do node 4, para o branch bloqueado) — salva a mensagem e sinaliza que precisa de atendimento humano (provavelmente grava algo em `mensagens.regra` ou atualiza `leads.atendimento_ia`).

Rewiring necessário:
- Remover a conexão `Supervisor1 → Busca Telefone1` (node desativado, não deve mais estar no caminho).
- Inserir a nova cadeia de guard rails entre a saída "IA Ativa" do `Rota Atendimento1` e o `ROTA Mensagens1`.
- Adicionar o caminho `Supervisor1 → Salvar Mensagem do Lead → Cria Histórico Supabase1`.

Depois de tudo isso existir, aplicar o **prompt de sistema final da Helô** no `Supervisor1` (persona Helô/Herval, regras rígidas, injeção dinâmica de clínica/especialidade/preço/objeção via referências ao node `Buscar Contexto de Negocio`) — esse prompt também precisa ser redigido do zero nesta próxima fase, pelo mesmo motivo acima (o texto exato da versão anterior não está disponível).

## 8. Pendências do usuário (não fazer por ele)

- Criar credencial **Anthropic** no n8n e conectar no node `Anthropic Chat Model`.
- Criar/confirmar credencial **Postgres/Supabase** (service role key) no n8n e conectar em todos os nodes Supabase tocados (existentes e novos).
- Se a Claude Code tentar a rota de API REST do n8n (seção 4), o usuário provavelmente precisa gerar uma API key do n8n (Settings → API) e informar onde ela deve ficar (variável de ambiente, por exemplo) — mas isso é infraestrutura de acesso, não uma "credencial de node" propriamente, então não conflita com a regra da seção 3. Ainda assim, vale confirmar com o usuário antes de usá-la.

## 9. Método de verificação — manter sempre

Depois de qualquer lote de edições, ler o estado real do workflow (`mcp__n8n__get_workflow_details` com `detailLevel: "full"`, ou a API REST equivalente) e conferir campo a campo (`disabled`, `parameters`, `connections`) antes de reportar como concluído. Nunca declarar algo "feito" só com base em screenshot ou na própria ação executada — confirmar no dado bruto. Foi assim que o bug do node desativado (seção 5.1) foi encontrado nesta sessão, apesar de a ação de edição em si ter sido reportada como bem-sucedida na hora.
