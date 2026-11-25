/**
 * As regras da tela de Pacientes que não dependem de banco nem de sessão:
 * telefone, chave de duplicado, leitura e escrita de CSV, conferência do que
 * a tela manda gravar.
 *
 * Mora fora de `dados/pacientes.ts` e de `acoes/pacientes.ts` pelo mesmo
 * motivo de `linhaDoFunil.ts`: um arquivo `"use server"` só exporta função
 * assíncrona, e o que está aqui também roda no navegador (a prévia da
 * importação e o CSV da exportação são montados lá).
 *
 * "Paciente" aqui é o mesmo registro de `leads` — não existe tabela à parte.
 * É isso que faz a tela conversar com o resto: editar o nome ou trocar a
 * etapa aqui é o mesmo que fazer pelo Funil ou pelo Atendimento.
 */

import {
  ETAPA_GANHA,
  ETAPA_PERDIDA,
  etapasFunil,
  type EtapaFunil,
} from "@/data/leads";

/** Quantos pacientes cada página mostra. */
export const PACIENTES_POR_PAGINA = 25;

/** Teto de uma importação. Arquivo maior vai em partes. */
export const TETO_DA_IMPORTACAO = 2000;

/**
 * Teto das ações em lote (alterar etapa, excluir). É o tamanho da página: a
 * seleção vale para o que está na tela, e ninguém exclui 300 pacientes num
 * clique sem ter visto quem eram.
 */
export const TETO_DO_LOTE = PACIENTES_POR_PAGINA;

/**
 * Etapas que entram na régua de follow-up da Helô. Importar alguém direto numa
 * delas pode fazer a régua mandar mensagem para quem nunca falou com a clínica
 * por WhatsApp — a prévia da importação avisa antes.
 */
export const ETAPAS_DA_REGUA: EtapaFunil[] = [
  "Em Contato",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
];

/**
 * Venda Ganha pede a venda (valor e procedimento) e Venda Perdida pede o
 * motivo: nenhuma das duas cabe numa linha de planilha nem numa troca em
 * lote sem esses dados. A importação recusa as duas; o lote recusa Venda
 * Ganha (Venda Perdida em lote pede o motivo uma vez, para todos).
 */
export const ETAPAS_FORA_DA_IMPORTACAO: EtapaFunil[] = [
  ETAPA_GANHA,
  ETAPA_PERDIDA,
];

export type PacienteDaLista = {
  id: number;
  nome: string;
  /** Como está gravado (só dígitos, com 55). */
  telefone: string;
  /** Texto do banco. Pode não ser uma das etapas do funil — ver `etapaDaLista`. */
  etapa: string;
  clinicaId: number | null;
  /** Nome do cliente da agência, para a Herval ver de quem é o paciente. */
  cliente: string | null;
  especialidadeId: number | null;
};

export type OpcaoSimples = { id: number; nome: string };

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------

/**
 * Deixa o telefone no formato em que a Helô grava: só dígitos, com o 55 na
 * frente (ex.: 5511999998888). É por esse texto que o banco impede o mesmo
 * número duas vezes na mesma clínica, e é por ele que a conversa do WhatsApp
 * encontra o lead — gravado de outro jeito, o mesmo paciente viraria dois.
 *
 * Devolve `null` quando não dá para ser um celular ou fixo brasileiro.
 */
export function normalizarTelefone(texto: string): string | null {
  let digitos = texto.replace(/\D/g, "").replace(/^0+/, "");

  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;

  if (
    (digitos.length === 12 || digitos.length === 13) &&
    digitos.startsWith("55")
  ) {
    return digitos;
  }

  return null;
}

/** 5511999998888 → (11) 99999-8888. O que não reconhece volta como veio. */
export function formatarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return "Sem telefone";

  const nacional =
    digitos.startsWith("55") && digitos.length >= 12
      ? digitos.slice(2)
      : digitos;

  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return telefone;
}

/**
 * A chave que junta o mesmo número escrito de jeitos diferentes: DDD mais os
 * oito últimos dígitos. Assim 5511999998888 e 551199998888 (com e sem o nono
 * dígito) caem juntos — o banco não pega esse caso, porque para ele são dois
 * textos diferentes.
 */
export function chaveDoTelefone(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const nacional =
    digitos.startsWith("55") && digitos.length >= 12
      ? digitos.slice(2)
      : digitos;
  return `${nacional.slice(0, 2)}${nacional.slice(-8)}`;
}

/**
 * Nome comparável: sem acento, minúsculo, espaços simples. Só nome com pelo
 * menos duas palavras vira chave — "Maria" e "Maria" são, quase sempre, duas
 * pessoas diferentes.
 */
export function chaveDoNome(nome: string): string | null {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.split(" ").length >= 2 ? limpo : null;
}

// ---------------------------------------------------------------------------
// Duplicados
// ---------------------------------------------------------------------------

export type PacienteDuplicado = {
  id: number;
  nome: string;
  telefone: string;
  etapa: string;
  criadoEm: string;
  cliente: string | null;
};

export type GrupoDeDuplicados = {
  motivo: "Mesmo telefone" | "Mesmo nome";
  pacientes: PacienteDuplicado[];
};

/**
 * Junta os pacientes que parecem ser a mesma pessoa, sempre dentro da mesma
 * clínica (o mesmo número em duas clínicas é paciente de duas clínicas, não
 * duplicado). Telefone vem antes: quem já caiu num grupo de telefone não
 * aparece de novo num grupo de nome.
 */
export function agruparDuplicados(
  linhas: (PacienteDuplicado & { clinicaId: number | null })[],
): GrupoDeDuplicados[] {
  const porTelefone = new Map<string, typeof linhas>();
  for (const linha of linhas) {
    const chave = chaveDoTelefone(linha.telefone);
    if (!chave) continue;
    const completa = `${linha.clinicaId ?? "sem"}|${chave}`;
    porTelefone.set(completa, [...(porTelefone.get(completa) ?? []), linha]);
  }

  const grupos: GrupoDeDuplicados[] = [];
  const jaAgrupados = new Set<number>();

  for (const grupo of porTelefone.values()) {
    if (grupo.length < 2) continue;
    grupo.forEach((p) => jaAgrupados.add(p.id));
    grupos.push({ motivo: "Mesmo telefone", pacientes: grupo.map(semClinica) });
  }

  const porNome = new Map<string, typeof linhas>();
  for (const linha of linhas) {
    if (jaAgrupados.has(linha.id)) continue;
    const chave = chaveDoNome(linha.nome);
    if (!chave) continue;
    const completa = `${linha.clinicaId ?? "sem"}|${chave}`;
    porNome.set(completa, [...(porNome.get(completa) ?? []), linha]);
  }

  for (const grupo of porNome.values()) {
    if (grupo.length < 2) continue;
    grupos.push({ motivo: "Mesmo nome", pacientes: grupo.map(semClinica) });
  }

  return grupos;
}

function semClinica(
  linha: PacienteDuplicado & { clinicaId: number | null },
): PacienteDuplicado {
  return {
    id: linha.id,
    nome: linha.nome,
    telefone: linha.telefone,
    etapa: linha.etapa,
    criadoEm: linha.criadoEm,
    cliente: linha.cliente,
  };
}

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

/**
 * O termo da busca entra num filtro `or` do PostgREST, onde vírgula, parêntese
 * e asterisco têm significado. Tirar esses caracteres é o que impede a busca
 * de virar outro filtro.
 */
export function limparBusca(texto: string): string {
  return texto
    .replace(/[,()*%\\:"'.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Etapa
// ---------------------------------------------------------------------------

export function etapaDaLista(valor: string | null | undefined): EtapaFunil | null {
  if (!valor) return null;
  return (etapasFunil as string[]).includes(valor) ? (valor as EtapaFunil) : null;
}

/** Aceita a etapa da planilha sem exigir maiúscula e acento iguais. */
function etapaDaPlanilha(valor: string): EtapaFunil | null {
  const alvo = comparavel(valor);
  return etapasFunil.find((etapa) => comparavel(etapa) === alvo) ?? null;
}

function comparavel(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Edição
// ---------------------------------------------------------------------------

export type EdicaoConferida = {
  nome: string;
  telefone: string;
  especialidadeId: number | null;
};

/** Confere o que o formulário de edição mandou, antes de gravar. */
export function conferirEdicao(
  nome: string,
  telefone: string,
  especialidadeId: number | null,
): { erro: string } | EdicaoConferida {
  const nomeLimpo = nome.replace(/\s+/g, " ").trim();
  if (nomeLimpo.length < 2) return { erro: "Escreva o nome do paciente." };
  if (nomeLimpo.length > 120) return { erro: "O nome passou de 120 letras." };

  const telefoneLimpo = normalizarTelefone(telefone);
  if (telefoneLimpo === null) {
    return {
      erro: "Telefone inválido. Use DDD e número, por exemplo (11) 99999-8888.",
    };
  }

  if (
    especialidadeId !== null &&
    (!Number.isInteger(especialidadeId) || especialidadeId <= 0)
  ) {
    return { erro: "Esse procedimento não existe na lista." };
  }

  return { nome: nomeLimpo, telefone: telefoneLimpo, especialidadeId };
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

export type LinhaImportada = {
  nome: string;
  telefone: string;
  etapa: EtapaFunil;
};

export type RecusaDaImportacao = { linha: number; motivo: string };

export type PreviaDaImportacao = {
  validas: LinhaImportada[];
  recusadas: RecusaDaImportacao[];
  /** Mesmo telefone mais de uma vez no próprio arquivo: entra só a primeira. */
  repetidasNoArquivo: number;
};

/**
 * Lê o CSV da importação. Aceita ponto e vírgula (o que o Excel em português
 * salva) ou vírgula, com ou sem cabeçalho.
 *
 * Com cabeçalho, as colunas são achadas pelo nome ("nome", "telefone" ou
 * "celular" ou "whatsapp", "etapa"). Sem cabeçalho, a ordem é nome, telefone,
 * etapa. A etapa é opcional: vazia, o paciente entra em "Leads Recebidos",
 * que é onde o banco já põe todo lead novo.
 */
export function lerPlanilha(texto: string): PreviaDaImportacao {
  const linhas = texto
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "");

  const vazia: PreviaDaImportacao = {
    validas: [],
    recusadas: [],
    repetidasNoArquivo: 0,
  };
  if (linhas.length === 0) return vazia;

  const separador =
    (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const primeira = dividirLinha(linhas[0], separador).map(comparavel);
  const indice = (nomes: string[]) =>
    primeira.findIndex((coluna) => nomes.includes(coluna));
  const temCabecalho = indice(["nome", "nome completo", "paciente"]) >= 0;

  const colunaNome = temCabecalho ? indice(["nome", "nome completo", "paciente"]) : 0;
  const colunaTelefone = temCabecalho
    ? indice(["telefone", "celular", "whatsapp", "fone", "numero"])
    : 1;
  const colunaEtapa = temCabecalho ? indice(["etapa", "etapa do funil"]) : 2;

  if (temCabecalho && colunaTelefone < 0) {
    return {
      ...vazia,
      recusadas: [
        { linha: 1, motivo: "O cabeçalho não tem a coluna de telefone." },
      ],
    };
  }

  const resultado: PreviaDaImportacao = { ...vazia, validas: [], recusadas: [] };
  const vistos = new Set<string>();

  linhas.slice(temCabecalho ? 1 : 0).forEach((bruta, posicao) => {
    const numeroDaLinha = posicao + (temCabecalho ? 2 : 1);
    const campos = dividirLinha(bruta, separador);

    const nome = (campos[colunaNome] ?? "").replace(/\s+/g, " ").trim();
    const telefone = normalizarTelefone(campos[colunaTelefone] ?? "");
    const etapaBruta = colunaEtapa >= 0 ? (campos[colunaEtapa] ?? "").trim() : "";

    if (nome.length < 2) {
      resultado.recusadas.push({ linha: numeroDaLinha, motivo: "sem nome" });
      return;
    }
    if (telefone === null) {
      resultado.recusadas.push({
        linha: numeroDaLinha,
        motivo: "telefone inválido",
      });
      return;
    }

    let etapa: EtapaFunil = "Leads Recebidos";
    if (etapaBruta !== "") {
      const achada = etapaDaPlanilha(etapaBruta);
      if (achada === null) {
        resultado.recusadas.push({
          linha: numeroDaLinha,
          motivo: `etapa "${etapaBruta}" não existe no funil`,
        });
        return;
      }
      if (ETAPAS_FORA_DA_IMPORTACAO.includes(achada)) {
        resultado.recusadas.push({
          linha: numeroDaLinha,
          motivo: `"${achada}" não entra por importação`,
        });
        return;
      }
      etapa = achada;
    }

    if (vistos.has(telefone)) {
      resultado.repetidasNoArquivo += 1;
      return;
    }
    vistos.add(telefone);

    resultado.validas.push({ nome: nome.slice(0, 120), telefone, etapa });
  });

  return resultado;
}

/** Divide uma linha de CSV respeitando aspas ("Silva; Maria"). */
function dividirLinha(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let entreAspas = false;

  for (let i = 0; i < linha.length; i += 1) {
    const caractere = linha[i];
    if (caractere === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (caractere === separador && !entreAspas) {
      campos.push(atual.trim());
      atual = "";
    } else {
      atual += caractere;
    }
  }
  campos.push(atual.trim());
  return campos;
}

/** Confere de novo, no servidor, cada linha que a prévia aprovou. */
export function conferirLinhaImportada(
  linha: unknown,
): LinhaImportada | null {
  if (typeof linha !== "object" || linha === null) return null;
  const { nome, telefone, etapa } = linha as Record<string, unknown>;
  if (typeof nome !== "string" || typeof telefone !== "string") return null;

  const nomeLimpo = nome.replace(/\s+/g, " ").trim();
  const telefoneLimpo = normalizarTelefone(telefone);
  const etapaLimpa = etapaDaLista(typeof etapa === "string" ? etapa : null);

  if (nomeLimpo.length < 2 || telefoneLimpo === null || etapaLimpa === null) {
    return null;
  }
  if (ETAPAS_FORA_DA_IMPORTACAO.includes(etapaLimpa)) return null;

  return { nome: nomeLimpo.slice(0, 120), telefone: telefoneLimpo, etapa: etapaLimpa };
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

export type LinhaExportada = {
  nome: string;
  telefone: string;
  etapa: string;
  cliente: string | null;
  procedimento: string | null;
  criadoEm: string;
  motivoPerda: string | null;
};

/**
 * Monta o CSV no formato que o Excel em português abre direto: ponto e
 * vírgula, e a marca BOM no começo para os acentos não virarem lixo.
 */
export function montarCsv(linhas: LinhaExportada[]): string {
  const cabecalho = [
    "Nome",
    "Telefone",
    "Etapa",
    "Cliente",
    "Procedimento de interesse",
    "Chegou em",
    "Motivo da perda",
  ];

  const corpo = linhas.map((linha) =>
    [
      linha.nome,
      linha.telefone,
      linha.etapa,
      linha.cliente ?? "",
      linha.procedimento ?? "",
      formatarDataCurta(linha.criadoEm),
      linha.motivoPerda ?? "",
    ]
      .map(celula)
      .join(";"),
  );

  return `﻿${[cabecalho.join(";"), ...corpo].join("\r\n")}`;
}

function celula(valor: string) {
  // Começar com = + - @ faz o Excel tratar a célula como fórmula.
  const seguro = /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Data e hora de Brasília, "24/11/2026 14:05". */
export function formatarDataCurta(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
