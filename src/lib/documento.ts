/**
 * CPF e CNPJ — normalização e validação do dígito verificador.
 *
 * Usado só no cadastro self-service: o documento é a chave que liga a
 * pessoa que está se cadastrando à clínica que a Herval já tem em
 * `clinicas.cpf_cnpj` (ver migração `cadastro_cliente_cpf_cnpj`). Guardar e
 * comparar sempre em dígitos, nunca com pontuação, é o que faz "123.456..."
 * e "12345600..." serem a mesma coisa.
 */

export function normalizarDocumento(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitosRepetidos(doc: string): boolean {
  return /^(\d)\1+$/.test(doc);
}

function calcularDigitoCpf(base: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += Number(base[i]) * (pesoInicial - i);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function validarCpf(doc: string): boolean {
  if (doc.length !== 11 || digitosRepetidos(doc)) return false;
  const d1 = calcularDigitoCpf(doc.slice(0, 9), 10);
  const d2 = calcularDigitoCpf(doc.slice(0, 9) + d1, 11);
  return doc === doc.slice(0, 9) + String(d1) + String(d2);
}

function calcularDigitoCnpj(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += Number(base[i]) * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function validarCnpj(doc: string): boolean {
  if (doc.length !== 14 || digitosRepetidos(doc)) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcularDigitoCnpj(doc.slice(0, 12), pesos1);
  const d2 = calcularDigitoCnpj(doc.slice(0, 12) + d1, pesos2);
  return doc === doc.slice(0, 12) + String(d1) + String(d2);
}

/** Aceita CPF (11 dígitos) ou CNPJ (14 dígitos), já normalizado ou não. */
export function validarCpfCnpj(valor: string): boolean {
  const doc = normalizarDocumento(valor);
  if (doc.length === 11) return validarCpf(doc);
  if (doc.length === 14) return validarCnpj(doc);
  return false;
}
