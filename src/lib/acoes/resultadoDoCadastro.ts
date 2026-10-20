/**
 * A resposta que as gravações devolvem para a tela.
 *
 * Mora fora do arquivo das ações de propósito: um arquivo `"use server"` só
 * pode exportar função assíncrona — tudo o que ele exporta vira um endereço
 * chamável de fora. Uma constante ali dentro derruba a página inteira em
 * tempo de execução, e o `build` não avisa.
 */

/**
 * O cliente que acabou de ser criado, com a unidade que o gatilho criou junto.
 *
 * Vai de volta para a tela porque o cadastro continua ali mesmo: quem cadastrou
 * a clínica vai cadastrar quem atende nela na sequência, e o formulário precisa
 * saber em qual unidade marcar. Esperar a página recarregar para descobrir isso
 * deixaria o passo seguinte com a lista de lugares vazia.
 */
import type { Tarefa } from "@/data/tarefas";
import type { Objecao } from "@/data/objecoes";
import type { MensagemFollowUp } from "@/lib/dados/followUp";

export type ClienteCriado = {
  id: number;
  nome: string;
  unidades: { id: number; nome: string }[];
};

export type ResultadoDoCadastro = {
  ok: boolean;
  /** Vazio antes do primeiro envio. Erro sempre vem com motivo em português. */
  mensagem: string;
  /**
   * Muda a cada envio, mesmo quando o texto é igual. É o que permite à tela
   * reagir duas vezes seguidas ao mesmo erro — sem isso, quem errasse o mesmo
   * campo duas vezes veria a tela parada e acharia que o botão não funcionou.
   */
  envio: number;
  /** Só vem preenchido quando a gravação criou um cliente. */
  cliente?: ClienteCriado;
  /**
   * Só vem preenchido quando a gravação criou uma tarefa.
   *
   * Volta pronta para a tela pelo mesmo motivo de `cliente`: a fila é estado do
   * navegador, inicializado com o que o servidor leu. Sem a tarefa de volta,
   * quem acabou de criar não a veria até recarregar a página — e acharia que o
   * botão não funcionou.
   */
  tarefa?: Tarefa;
  /**
   * Só vem preenchida quando a gravação criou uma objeção, com o `id` e o
   * `usos` que só o banco sabe — a tela não tem como adivinhar e não devia
   * inventar.
   */
  objecao?: Objecao;
  /**
   * Só vem preenchida quando a gravação criou uma mensagem de follow-up, com
   * o `id` e a `ordem` que só o banco sabe — mesma lógica de `objecao`.
   */
  mensagemFollowUp?: MensagemFollowUp;
};

export const RESULTADO_INICIAL: ResultadoDoCadastro = {
  ok: false,
  mensagem: "",
  envio: 0,
};
