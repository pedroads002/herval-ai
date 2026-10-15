/**
 * O convite de autocadastro: link + código de acesso.
 *
 * Mora fora de `lib/acoes` e fora de `app/api` de propósito: as duas rotas que
 * usam isto (`/api/admin/convidar-cliente` para criar, `/api/convite/completar`
 * para consumir) precisam gerar e conferir o mesmo jeito, e repetir a lógica
 * em cada arquivo é como duas versões da mesma regra nascem diferentes.
 *
 * O desenho — por que token e código são coisas separadas — está documentado
 * em `supabase/convites.sql`. Resumo: o token (32 bytes, na URL) já é segredo
 * suficiente sozinho; o código é o segundo fator, pensado para chegar por um
 * canal diferente do link. Por isso o código pode ser curto e fácil de
 * digitar — ele não precisa resistir a força bruta por si só.
 */

import { randomBytes, randomInt, timingSafeEqual, createHash } from "crypto";

export const VALIDADE_DO_CONVITE_EM_DIAS = 7;

/** Depois de errar o código estas vezes, o convite morre — ver `codigoEstaDentroDoLimite`. */
export const TENTATIVAS_MAXIMAS_DO_CODIGO = 5;

/**
 * Sem O/0 nem I/1: são os quatro caracteres mais fáceis de trocar um pelo
 * outro ao digitar um código em voz alta ou numa tela pequena.
 */
const ALFABETO_DO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarToken() {
  return randomBytes(32).toString("base64url");
}

export function gerarCodigoDeAcesso(tamanho = 8) {
  let codigo = "";
  for (let i = 0; i < tamanho; i++) {
    codigo += ALFABETO_DO_CODIGO[randomInt(ALFABETO_DO_CODIGO.length)];
  }
  return codigo;
}

export function gerarSal() {
  return randomBytes(16).toString("hex");
}

/** Maiúsculo antes de somar: quem digita não deveria precisar acertar a caixa. */
function normalizar(codigo: string) {
  return codigo.trim().toUpperCase();
}

export function hashDoCodigo(codigo: string, sal: string) {
  return createHash("sha256").update(`${sal}:${normalizar(codigo)}`).digest("hex");
}

/**
 * Compara em tempo constante. `timingSafeEqual` explode se os dois buffers
 * não tiverem o mesmo tamanho — por isso a conferência de tamanho vem antes,
 * e não é ela quem decide o resultado: só evita a exceção.
 */
export function codigoCorreto(codigo: string, sal: string, hashGravado: string) {
  const calculado = Buffer.from(hashDoCodigo(codigo, sal), "hex");
  const gravado = Buffer.from(hashGravado, "hex");
  if (calculado.length !== gravado.length) return false;
  return timingSafeEqual(calculado, gravado);
}

export function expiraEm(dias = VALIDADE_DO_CONVITE_EM_DIAS) {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
}

/** Quando parar de aceitar tentativa — o motivo some da mensagem de erro, nunca do porquê. */
export function dentroDoLimiteDeTentativas(tentativas: number) {
  return tentativas < TENTATIVAS_MAXIMAS_DO_CODIGO;
}
