/**
 * Os dezessete cargos, na ordem em que a Herval os usa.
 *
 * Esta lista é a do formulário. A do banco é um CHECK na coluna `tipo`, e as
 * duas precisam concordar — se um cargo for incluído no banco, é para ser
 * incluído aqui também.
 *
 * Mora sozinha, e não junto da leitura do banco, porque quem mais precisa dela
 * é o formulário, que roda no navegador. Deixá-la no módulo de leitura fazia o
 * `import` arrastar o cliente do Supabase do servidor para dentro do bundle.
 */
export const tiposDeProfissional = [
  "Dentista",
  "Cirurgião Dentista",
  "Dermatologista",
  "Médico",
  "Médico Cirurgião",
  "Médico Esteta",
  "Biomédico",
  "Biomédico Esteticista",
  "Enfermeiro",
  "Enfermeiro Esteta",
  "Nutricionista",
  "Fisioterapeuta",
  "Farmacêutico",
  "Psicólogo",
  "Psiquiatra",
  "Esteticista",
  "Avaliador",
] as const;

export type TipoDeProfissional = (typeof tiposDeProfissional)[number];
