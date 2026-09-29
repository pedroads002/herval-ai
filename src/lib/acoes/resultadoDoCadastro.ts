/**
 * A resposta que as gravações devolvem para a tela.
 *
 * Mora fora do arquivo das ações de propósito: um arquivo `"use server"` só
 * pode exportar função assíncrona — tudo o que ele exporta vira um endereço
 * chamável de fora. Uma constante ali dentro derruba a página inteira em
 * tempo de execução, e o `build` não avisa.
 */

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
};

export const RESULTADO_INICIAL: ResultadoDoCadastro = {
  ok: false,
  mensagem: "",
  envio: 0,
};
