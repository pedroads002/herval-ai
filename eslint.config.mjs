/**
 * Configuração do ESLint.
 *
 * Existe porque o `npm run lint` chamava `next lint`, e esse comando foi
 * removido nesta versão do Next — o projeto ficou sem corretor nenhum. Agora o
 * script chama o ESLint direto, e é este arquivo que diz a ele o que checar.
 *
 * `core-web-vitals` é a configuração oficial do Next: ela junta as regras do
 * React, dos Hooks e do próprio Next, e trata como erro (não como aviso) o que
 * afeta a velocidade de carregamento da página.
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    // O que o eslint-config-next já ignora por padrão. Repetido aqui porque
    // declarar `globalIgnores` substitui a lista dele em vez de somar.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
