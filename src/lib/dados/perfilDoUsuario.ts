/**
 * A conferência do que a tela de Perfil manda gravar.
 *
 * Fica fora da ação de servidor porque é a regra, não o acesso ao banco: é o
 * que decide se "Pedro" vira assinatura de tarefa, nota e mensagem. Separada,
 * ela é lida e testada sem subir o painel.
 *
 * O e-mail não entra aqui de propósito: ele é o login, vem do Supabase Auth e
 * não se edita no painel. Deixar o e-mail editável criaria uma assinatura que
 * discorda de quem entrou.
 */

export const LIMITE_DO_NOME = 40;

export type NovoPerfil = {
  nome: string;
  sobrenome: string;
};

export type PerfilConferido = {
  nome: string;
  sobrenome: string;
};

/**
 * Nome é obrigatório; sobrenome não.
 *
 * "Equipe Herval" e "Pedro Aguiar" são os dois casos reais, e um deles não tem
 * sobrenome no sentido de cadastro — exigir os dois obrigaria a inventar um.
 */
export function conferirPerfil(
  entrada: NovoPerfil,
): { erro: string } | { linha: PerfilConferido } {
  const nome = entrada.nome.trim().replace(/\s+/g, " ");
  const sobrenome = entrada.sobrenome.trim().replace(/\s+/g, " ");

  if (nome === "") {
    return { erro: "Escreva o nome que vai assinar o que você gravar." };
  }
  if (nome.length > LIMITE_DO_NOME) {
    return { erro: `O nome passa de ${LIMITE_DO_NOME} caracteres.` };
  }
  if (sobrenome.length > LIMITE_DO_NOME) {
    return { erro: `O sobrenome passa de ${LIMITE_DO_NOME} caracteres.` };
  }

  return { linha: { nome, sobrenome } };
}
