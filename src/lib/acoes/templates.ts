"use server";

/**
 * As gravações dos templates de WhatsApp.
 *
 *   criarTemplate       um conjunto novo de mensagens para um cliente numa
 *                       categoria. Nasce **desligado**: template sem mensagem
 *                       nenhuma, se nascesse ativo, faria a Helô chegar na hora
 *                       do envio e não achar texto para mandar.
 *   ativarTemplate      põe este no ar e desliga o irmão da mesma
 *                       clínica+categoria. Exige ao menos uma mensagem.
 *   excluirTemplate     tira do banco, com as mensagens dele (a chave
 *                       estrangeira é `on delete cascade`) e com os arquivos
 *                       dele no Storage. Só o que está desligado: excluir o
 *                       ativo deixaria a categoria muda sem ninguém pedir isso.
 *   adicionarMensagem   entra uma bolha ao final do template. `ordem` é
 *                       calculada aqui, nunca recebida da tela — igual a
 *                       `acoes/followUp.ts`.
 *   editarMensagem      formato, texto/legenda, mídia e espera (valor e
 *                       unidade) de uma bolha.
 *                       Trocar o arquivo, ou voltar a bolha para texto, apaga
 *                       no Storage o arquivo que saiu.
 *   removerMensagem     tira a bolha, e com ela o arquivo de mídia que era só
 *                       dela. Os números das irmãs não são
 *                       recalculados: `ordem` só precisa ser única e crescente
 *                       dentro do template, e a tela numera pela posição na
 *                       lista, então um buraco em `ordem` não aparece.
 *   moverMensagem       sobe ou desce uma bolha, trocando com a vizinha.
 *
 * **Escrita só para a Herval.** A RLS das três tabelas já tem `somente_herval`
 * (`eh_herval_admin()`), mas `update` e `delete` barrados por RLS voltam sem
 * erro e com zero linhas afetadas — quem não fosse admin veria "alterações
 * salvas" sem nada ter sido salvo. Por isso cada ação confere o papel aqui,
 * antes de gravar, em vez de só confiar na política.
 *
 * O n8n lê estas mesmas tabelas direto no SQL, e o consumo já está em
 * produção. Estas ações não tocam no workflow: mudou o texto aqui, a próxima
 * vez que o n8n ler o banco já vê a mudança, sem publicar nada lá.
 */

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado, supabaseUrl } from "@/lib/supabase/config";
import { carregarAutorizacao, ehHervalAdmin } from "@/lib/autorizacao";
import {
  FORMATOS_DE_MENSAGEM,
  UNIDADES_DE_ESPERA,
  type FormatoDeMensagem,
  type UnidadeDeEspera,
} from "@/data/templates";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";

const LIMITE_NOME = 120;
const LIMITE_TEXTO = 1200;
/**
 * O teto da espera, por unidade.
 *
 * Segundos continua em 60, que era o limite do campo antes de a unidade
 * existir — a unidade entrou para dizer esperas mais longas, não para alargar
 * a antiga. Os outros tetos são o que faz sentido numa régua de mensagem:
 * duas horas em minutos, dois dias em horas, um mês em dias. O banco não tem
 * CHECK no valor (só na unidade), então este limite é aqui mesmo.
 */
const ESPERA_MINIMA = 0;
const ESPERA_MAXIMA: Record<UnidadeDeEspera, number> = {
  segundos: 60,
  minutos: 120,
  horas: 48,
  dias: 30,
};

/** O mesmo bucket das outras mídias do cliente — ver a rota do upload. */
const BUCKET = "clinicas-midia";
const PREFIXO_DA_MIDIA = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/`;

type ClienteDoServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

function recusar(mensagem: string): ResultadoDoCadastro {
  return { ok: false, mensagem, envio: Date.now() };
}

function aceitar(mensagem: string): ResultadoDoCadastro {
  return { ok: true, mensagem, envio: Date.now() };
}

async function exigirAdmin(): Promise<
  { erro: string } | { supabase: ClienteDoServidor }
> {
  if (!supabaseConfigurado()) {
    return { erro: "O Supabase não está configurado neste ambiente." };
  }

  const autorizacao = await carregarAutorizacao();
  if (!autorizacao) {
    return { erro: "Sua sessão expirou. Entre de novo para gravar." };
  }
  if (!ehHervalAdmin(autorizacao)) {
    return { erro: "Só a Herval altera os templates." };
  }

  return { supabase: await criarClienteServidor() };
}

/**
 * O caminho do arquivo dentro do bucket, a partir do endereço público.
 *
 * Devolve `null` para endereço que não é do nosso bucket: o campo
 * `midia_url` é texto, e apagar caminho vindo de endereço estranho seria
 * apagar arquivo que não é desta mensagem.
 */
function caminhoDaMidia(url: string | null): string | null {
  if (!url || !url.startsWith(PREFIXO_DA_MIDIA)) return null;

  const caminho = url.slice(PREFIXO_DA_MIDIA.length);
  return caminho.startsWith("templates/") ? caminho : null;
}

/**
 * Apaga no Storage arquivos que acabaram de perder o dono.
 *
 * Passa pela `service_role` (`criarClienteAdmin`) pelo mesmo motivo da rota do
 * upload: `storage.objects` está com RLS ligada e sem política nenhuma, então
 * a sessão de quem está logado não apaga arquivo nenhum. A decisão de
 * 05/11/2026 foi não criar política de storage, e sim usar a chave de serviço
 * atrás da mesma tranca de papel — e o papel já foi conferido por
 * `exigirAdmin` antes de chegar aqui.
 *
 * Devolve o motivo quando não deu, em vez de lançar: a linha do banco já foi
 * apagada quando esta função roda, e a ação precisa poder contar as duas
 * coisas ao usuário.
 */
async function apagarArquivos(caminhos: string[]): Promise<string | null> {
  if (caminhos.length === 0) return null;

  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) {
    return "falta SUPABASE_SERVICE_ROLE_KEY neste ambiente";
  }

  const { error } = await clienteAdmin.storage.from(BUCKET).remove(caminhos);
  return error ? error.message : null;
}

/**
 * Tudo o que está na pasta de um template.
 *
 * A pasta é consultada em vez de montada a partir das linhas de
 * `template_mensagens` de propósito: assim também sai o arquivo que subiu e
 * nunca virou mensagem (o upload acontece antes de a bolha ser salva, então o
 * usuário que desiste no meio do formulário deixa um arquivo sozinho ali).
 *
 * `list` devolve no máximo um lote por chamada, daí a paginação — um template
 * com mais de cem arquivos é improvável, mas a volta é barata.
 */
async function arquivosDoTemplate(
  clinicaId: number,
  templateId: number,
): Promise<{ erro: string } | { caminhos: string[] }> {
  const clienteAdmin = criarClienteAdmin();
  if (!clienteAdmin) {
    return { erro: "falta SUPABASE_SERVICE_ROLE_KEY neste ambiente" };
  }

  const pasta = `templates/${clinicaId}/${templateId}`;
  const porLote = 100;
  const caminhos: string[] = [];

  for (let lote = 0; ; lote += 1) {
    const { data, error } = await clienteAdmin.storage
      .from(BUCKET)
      .list(pasta, { limit: porLote, offset: lote * porLote });

    if (error) return { erro: error.message };

    const itens = data ?? [];
    for (const item of itens) caminhos.push(`${pasta}/${item.name}`);
    if (itens.length < porLote) break;
  }

  return { caminhos };
}

function numero(formData: FormData, campo: string) {
  const n = Number(String(formData.get(campo) ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function formatoDoFormulario(formData: FormData): FormatoDeMensagem | null {
  const formato = String(formData.get("formato") ?? "").trim();
  return (FORMATOS_DE_MENSAGEM as readonly string[]).includes(formato)
    ? (formato as FormatoDeMensagem)
    : null;
}

type DadosDaMensagem = {
  formato: FormatoDeMensagem;
  texto: string | null;
  midia_url: string | null;
  delay_valor: number;
  delay_unidade: UnidadeDeEspera;
};

/**
 * O que a tela mandou para uma bolha, conferido antes de encostar no banco.
 *
 * As duas regras que o CHECK do banco também cobre (formato da lista, e ter
 * texto ou mídia) são conferidas aqui de novo de propósito: erro de CHECK
 * chegaria ao usuário como texto técnico em inglês.
 */
function lerMensagem(formData: FormData): { erro: string } | DadosDaMensagem {
  const formato = formatoDoFormulario(formData);
  if (formato === null) {
    return { erro: "Escolha o formato da mensagem." };
  }

  const texto = String(formData.get("texto") ?? "").trim();
  const midia = String(formData.get("midia_url") ?? "").trim();
  const espera = Number(String(formData.get("delay_valor") ?? "").trim());
  const unidadeEnviada = String(formData.get("delay_unidade") ?? "").trim();

  if (texto.length > LIMITE_TEXTO) {
    return { erro: `O texto passou de ${LIMITE_TEXTO} caracteres.` };
  }

  if (formato === "texto") {
    if (texto === "") return { erro: "Preencha o texto da mensagem." };
  } else if (midia === "") {
    return { erro: "Envie o arquivo desta mensagem." };
  }

  /*
    A mídia tem que ser um arquivo do nosso bucket. A tela só põe aqui o
    endereço que a rota do upload devolveu, mas o campo chega como texto por
    FormData: sem esta conferência, um endereço de fora passaria a ser o que a
    Helô manda para o paciente.
  */
  if (midia !== "" && !midia.startsWith(PREFIXO_DA_MIDIA)) {
    return { erro: "O arquivo desta mensagem não é um arquivo nosso." };
  }

  /*
    A unidade é conferida aqui antes de ir ao banco pelo mesmo motivo do
    formato: o CHECK `template_mensagens_delay_unidade_valida` também cobre
    isso, mas o erro chegaria à tela como texto técnico em inglês.
  */
  if (!(UNIDADES_DE_ESPERA as readonly string[]).includes(unidadeEnviada)) {
    return { erro: "Escolha a unidade de tempo da espera." };
  }

  const unidade = unidadeEnviada as UnidadeDeEspera;
  const teto = ESPERA_MAXIMA[unidade];

  if (!Number.isInteger(espera) || espera < ESPERA_MINIMA || espera > teto) {
    return {
      erro: `A espera precisa ser um número inteiro entre ${ESPERA_MINIMA} e ${teto} ${unidade}.`,
    };
  }

  return {
    formato,
    // Mídia sem legenda grava `null`, não string vazia: é o que diz "não tem
    // legenda" para quem lê a tabela, aqui e no n8n.
    texto: texto === "" ? null : texto,
    midia_url: formato === "texto" || midia === "" ? null : midia,
    delay_valor: espera,
    delay_unidade: unidade,
  };
}

export async function criarTemplate(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirAdmin();
  if ("erro" in sessao) return recusar(sessao.erro);

  const clinicaId = numero(formData, "clinica_id");
  const categoriaId = numero(formData, "categoria_id");
  if (clinicaId === null || categoriaId === null) {
    return recusar(
      "Não deu para saber de qual cliente e categoria é este template.",
    );
  }

  const nome = String(formData.get("nome") ?? "").trim();
  if (nome === "") return recusar("Dê um nome a este template.");
  if (nome.length > LIMITE_NOME) {
    return recusar(`O nome passou de ${LIMITE_NOME} caracteres.`);
  }

  const { error } = await sessao.supabase.from("templates").insert({
    clinica_id: clinicaId,
    categoria_id: categoriaId,
    nome,
    // Desligado de propósito — ver o topo do arquivo.
    ativo: false,
  });

  if (error) return recusar(`Não deu para criar: ${error.message}`);

  revalidatePath("/templates-whatsapp");
  return aceitar("Template criado. Escreva as mensagens e depois ative.");
}

export async function ativarTemplate(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirAdmin();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual template ativar.");

  const { data: template, error: erroDaLeitura } = await sessao.supabase
    .from("templates")
    .select("id, clinica_id, categoria_id, ativo")
    .eq("id", id)
    .maybeSingle();

  if (erroDaLeitura) {
    return recusar(`Não deu para ler o template: ${erroDaLeitura.message}`);
  }
  if (!template) return recusar("Este template não existe mais.");
  if (template.ativo) return aceitar("Este template já está ativo.");

  // Ativo sem mensagem é template que chega na hora do envio sem nada para
  // mandar. A conta é no banco, sem trazer linha.
  const { count, error: erroDaContagem } = await sessao.supabase
    .from("template_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("template_id", id);

  if (erroDaContagem) {
    return recusar(
      `Não deu para conferir as mensagens: ${erroDaContagem.message}`,
    );
  }
  if ((count ?? 0) === 0) {
    return recusar(
      "Este template não tem nenhuma mensagem. Escreva ao menos uma antes de ativar.",
    );
  }

  /*
    Desligar o irmão vem primeiro, e não é escolha de estilo: o índice único
    `templates_ativo_unico_por_categoria` cobre `(clinica_id, categoria_id)
    where ativo`, então ligar antes de desligar bateria no índice e a tela
    mostraria erro técnico de constraint.

    Não existe transação aqui (o cliente do Supabase não dá uma), então entre
    os dois passos a categoria fica um instante sem template ativo. Se o
    segundo passo falhar, ela continua sem — a recusa logo abaixo diz isso em
    português, a tela mostra "nenhum ativo" e um clique resolve. É o mesmo
    raciocínio de `trocarUnidades`, de cabeça para baixo: lá o risco era ficar
    sem vínculo, e por isso ele insere antes de apagar; aqui o índice obriga a
    ordem contrária.
  */
  const { error: erroAoDesligar } = await sessao.supabase
    .from("templates")
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq("clinica_id", template.clinica_id)
    .eq("categoria_id", template.categoria_id)
    .eq("ativo", true);

  if (erroAoDesligar) {
    return recusar(
      `Não deu para desligar o template anterior: ${erroAoDesligar.message}`,
    );
  }

  const { error: erroAoLigar } = await sessao.supabase
    .from("templates")
    .update({ ativo: true, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (erroAoLigar) {
    revalidatePath("/templates-whatsapp");
    return recusar(
      `O template anterior foi desligado, mas este não ligou (${erroAoLigar.message}). A categoria está sem template ativo — tente ativar de novo.`,
    );
  }

  revalidatePath("/templates-whatsapp");
  return aceitar("Template ativado. É este que a Helô passa a enviar.");
}

export async function excluirTemplate(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirAdmin();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual template excluir.");

  const { data: template, error: erroDaLeitura } = await sessao.supabase
    .from("templates")
    .select("id, clinica_id, ativo")
    .eq("id", id)
    .maybeSingle();

  if (erroDaLeitura) {
    return recusar(`Não deu para ler o template: ${erroDaLeitura.message}`);
  }
  if (!template) return recusar("Este template não existe mais.");
  if (template.ativo) {
    return recusar(
      "Este é o template ativo da categoria. Ative outro antes de excluir este.",
    );
  }

  const { error } = await sessao.supabase
    .from("templates")
    .delete()
    .eq("id", id);
  if (error) return recusar(`Não deu para excluir: ${error.message}`);

  /*
    As mensagens vão com ele, pelo `on delete cascade` da chave estrangeira. Os
    arquivos de mídia saem do bucket junto, por decisão dele em 05/11/2026:
    template excluído deixava a pasta `templates/{clinica}/{template}` cheia de
    arquivo sem dono, invisível no painel e sem jeito de limpar pela tela.

    O banco vem primeiro porque é ele que a tela mostra: se o Storage recusar
    depois, a exclusão não volta atrás — a recusa abaixo diz que sobrou arquivo,
    em vez de deixar a tela quieta sobre isso.
  */
  revalidatePath("/templates-whatsapp");

  const arquivos = await arquivosDoTemplate(template.clinica_id, id);
  if ("erro" in arquivos) {
    return recusar(
      `O template foi excluído, mas não deu para ler os arquivos dele no Storage (${arquivos.erro}). Os arquivos podem ter ficado lá.`,
    );
  }

  const falhaAoApagar = await apagarArquivos(arquivos.caminhos);
  if (falhaAoApagar) {
    return recusar(
      `O template foi excluído, mas os arquivos dele ficaram no Storage (${falhaAoApagar}).`,
    );
  }

  return aceitar("Template excluído.");
}

export async function adicionarMensagem(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirAdmin();
  if ("erro" in sessao) return recusar(sessao.erro);

  const templateId = numero(formData, "template_id");
  if (templateId === null) {
    return recusar(
      "Não deu para saber a qual template esta mensagem pertence.",
    );
  }

  const dados = lerMensagem(formData);
  if ("erro" in dados) return recusar(dados.erro);

  const { data: ultima, error: erroDaOrdem } = await sessao.supabase
    .from("template_mensagens")
    .select("ordem")
    .eq("template_id", templateId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroDaOrdem) {
    return recusar(`Não deu para calcular a ordem: ${erroDaOrdem.message}`);
  }

  const { error } = await sessao.supabase.from("template_mensagens").insert({
    template_id: templateId,
    ordem: (ultima?.ordem ?? 0) + 1,
    ...dados,
  });

  if (error) return recusar(`Não deu para adicionar: ${error.message}`);

  revalidatePath("/templates-whatsapp");
  return aceitar("Mensagem adicionada.");
}

export async function editarMensagem(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirAdmin();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual mensagem editar.");

  const dados = lerMensagem(formData);
  if ("erro" in dados) return recusar(dados.erro);

  // O endereço atual é lido antes de ser sobrescrito: trocar o arquivo da
  // bolha, ou voltar ela para "texto", deixava o arquivo anterior no bucket
  // sem ninguém apontando para ele.
  const { data: antes, error: erroDaLeitura } = await sessao.supabase
    .from("template_mensagens")
    .select("id, midia_url")
    .eq("id", id)
    .maybeSingle();

  if (erroDaLeitura) {
    return recusar(`Não deu para ler a mensagem: ${erroDaLeitura.message}`);
  }
  if (!antes) return recusar("Esta mensagem não existe mais.");

  const { error } = await sessao.supabase
    .from("template_mensagens")
    .update(dados)
    .eq("id", id);

  if (error) return recusar(`Não deu para salvar: ${error.message}`);

  revalidatePath("/templates-whatsapp");

  // Só o arquivo que saiu da mensagem. Salvar sem mexer na mídia mantém o
  // mesmo endereço, e aí não há nada a apagar.
  const antigo =
    antes.midia_url === dados.midia_url
      ? null
      : caminhoDaMidia(antes.midia_url);

  if (antigo) {
    const falhaAoApagar = await apagarArquivos([antigo]);
    if (falhaAoApagar) {
      return recusar(
        `As alterações foram salvas, mas o arquivo antigo ficou no Storage (${falhaAoApagar}).`,
      );
    }
  }

  return aceitar("Alterações salvas.");
}

export async function removerMensagem(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirAdmin();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  if (id === null) return recusar("Não deu para saber qual mensagem remover.");

  // O endereço do arquivo é lido antes do `delete`: depois a linha não existe
  // mais e não haveria como saber qual arquivo ficou sem dono.
  const { data: mensagem, error: erroDaLeitura } = await sessao.supabase
    .from("template_mensagens")
    .select("id, midia_url")
    .eq("id", id)
    .maybeSingle();

  if (erroDaLeitura) {
    return recusar(`Não deu para ler a mensagem: ${erroDaLeitura.message}`);
  }
  if (!mensagem) return recusar("Esta mensagem não existe mais.");

  const { error } = await sessao.supabase
    .from("template_mensagens")
    .delete()
    .eq("id", id);

  if (error) return recusar(`Não deu para remover: ${error.message}`);

  revalidatePath("/templates-whatsapp");

  // Bolha de áudio, imagem ou vídeo leva o arquivo dela embora. Mesma ordem da
  // exclusão de template: o banco primeiro, e o que sobrar é dito ao usuário.
  const caminho = caminhoDaMidia(mensagem.midia_url);
  if (caminho) {
    const falhaAoApagar = await apagarArquivos([caminho]);
    if (falhaAoApagar) {
      return recusar(
        `A mensagem foi removida, mas o arquivo dela ficou no Storage (${falhaAoApagar}).`,
      );
    }
  }

  return aceitar("Mensagem removida.");
}

export async function moverMensagem(
  _anterior: ResultadoDoCadastro,
  formData: FormData,
): Promise<ResultadoDoCadastro> {
  const sessao = await exigirAdmin();
  if ("erro" in sessao) return recusar(sessao.erro);

  const id = numero(formData, "id");
  const direcao = String(formData.get("direcao") ?? "").trim();

  if (id === null) return recusar("Não deu para saber qual mensagem mover.");
  if (direcao !== "subir" && direcao !== "descer") {
    return recusar("Não deu para saber para onde mover a mensagem.");
  }

  const { data: alvo, error: erroDoAlvo } = await sessao.supabase
    .from("template_mensagens")
    .select("id, template_id, ordem")
    .eq("id", id)
    .maybeSingle();

  if (erroDoAlvo)
    return recusar(`Não deu para ler a mensagem: ${erroDoAlvo.message}`);
  if (!alvo) return recusar("Esta mensagem não existe mais.");

  const { data: irmas, error: erroDasIrmas } = await sessao.supabase
    .from("template_mensagens")
    .select("id, ordem")
    .eq("template_id", alvo.template_id)
    .order("ordem", { ascending: true });

  if (erroDasIrmas) {
    return recusar(
      `Não deu para ler a ordem das mensagens: ${erroDasIrmas.message}`,
    );
  }

  const lista = (irmas ?? []) as { id: number; ordem: number }[];
  const posicao = lista.findIndex((m) => m.id === id);
  const vizinha = lista[posicao + (direcao === "subir" ? -1 : 1)];

  if (!vizinha) {
    return recusar(
      direcao === "subir"
        ? "Esta mensagem já é a primeira."
        : "Esta mensagem já é a última.",
    );
  }

  /*
    A troca passa por uma faixa livre, em três passos, porque
    `template_mensagens_ordem_unica` cobre `(template_id, ordem)` e não é
    `deferrable`: escrever direto a ordem da vizinha na alvo bateria no índice
    no meio do caminho. `livre` é um número que ninguém está usando — uma casa
    acima da última —, então nenhum dos três passos encosta em linha de outra.

    Se um passo falhar no meio, a mensagem pode ficar parada nessa casa de
    passagem, isto é, no fim da lista. Nada se perde e mover de novo acerta; a
    recusa diz isso em português em vez de deixar a tela quieta.
  */
  const livre = (lista[lista.length - 1]?.ordem ?? alvo.ordem) + 1;

  const passos: { id: number; ordem: number }[] = [
    { id: alvo.id, ordem: livre },
    { id: vizinha.id, ordem: alvo.ordem },
    { id: alvo.id, ordem: vizinha.ordem },
  ];

  for (const passo of passos) {
    const { error } = await sessao.supabase
      .from("template_mensagens")
      .update({ ordem: passo.ordem })
      .eq("id", passo.id);

    if (error) {
      revalidatePath("/templates-whatsapp");
      return recusar(
        `A troca de ordem parou no meio (${error.message}). Nenhuma mensagem foi perdida: confira a lista e mova de novo.`,
      );
    }
  }

  revalidatePath("/templates-whatsapp");
  return aceitar(direcao === "subir" ? "Mensagem subiu." : "Mensagem desceu.");
}
