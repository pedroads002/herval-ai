# Herval AI

Painel visual (front-end) do Herval AI. Nesta fase existe **apenas a interface**:
não há backend, banco de dados nem integração externa. Todos os dados são fixos,
escritos direto no código.

## Identidade visual

Paleta oficial Herval, usada de forma exclusiva (não há outras cores no
projeto):

| Cor    | Código    | Uso                                            |
| ------ | --------- | ---------------------------------------------- |
| Verde  | `#01D800` | destaque, item ativo, ações principais, badges  |
| Preto  | `#000000` | menu lateral, títulos, texto, estado encerrado  |
| Branco | `#FFFFFF` | fundo da página e dos cards                     |

Cinzas são obtidos por transparência do preto (`text-black/60`), para não
introduzir nenhuma cor nova. As cores ficam em `tailwind.config.ts` sob
`herval`.

### Logos

O cabeçalho superior usa `public/logo-light.png` e o rodapé do menu usa
`public/logo-dark.png`. **Basta colocar os dois arquivos na pasta `public/`** —
nada mais precisa ser alterado. Enquanto eles não existirem, aparece um
monograma "H" no lugar, para a tela não ficar com imagem quebrada.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- lucide-react (ícones)

## Como rodar

```bash
npm install
npm run dev
```

Depois abra http://localhost:3000 no navegador.

## Páginas

| Rota           | Tela                  |
| -------------- | --------------------- |
| `/`            | Fila de Tarefas       |
| `/estrategia`  | Estratégia da Clínica |
| `/objecoes`    | Quebra de Objeções    |
| `/integracoes` | Integrações           |

## Estrutura

```
src/
  app/
    layout.tsx          menu lateral + área de conteúdo
    page.tsx            Fila de Tarefas
    estrategia/page.tsx
    objecoes/page.tsx
    integracoes/page.tsx
    globals.css
  components/
    MenuLateral.tsx          menu fixo à esquerda
    Cabecalho.tsx            título + descrição da página
    Etiqueta.tsx             selo colorido de status
    TabelaTarefas.tsx        tabela com Aprovar/Rejeitar
    GerenciadorObjecoes.tsx  formulário + tabela editável
    FormularioEstrategia.tsx formulário com confirmação "Salvo"
  data/
    tarefas.ts          dados de exemplo da fila
    objecoes.ts         dados de exemplo das objeções
    estrategia.ts       valores de exemplo da estratégia
```

## Estado das telas

As telas interativas guardam tudo em `useState` (memória do navegador).
**Ao recarregar a página, tudo volta ao estado inicial** — não há backend, API
nem `localStorage`. Quando existir backend, os arquivos de `src/data/` serão
substituídos pela busca real de dados.
