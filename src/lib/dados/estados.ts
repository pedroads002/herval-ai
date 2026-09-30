/**
 * As 27 unidades federativas, em ordem alfabética de sigla.
 *
 * Mora sozinha pelo mesmo motivo da lista de áreas de atuação: quem precisa
 * dela é o formulário, que roda no navegador, e um `import` que puxasse o
 * módulo de leitura arrastaria o cliente do Supabase para dentro do bundle.
 *
 * É sigla, e não nome por extenso, porque é o que cabe num campo ao lado da
 * cidade e é como endereço é escrito no Brasil.
 */
export const estados = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

export type Estado = (typeof estados)[number];
