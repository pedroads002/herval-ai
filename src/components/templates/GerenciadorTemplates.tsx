"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Plus,
  Power,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  FORMATOS_DE_MENSAGEM,
  NOME_DA_UNIDADE,
  NOME_DO_FORMATO,
  UNIDADES_DE_ESPERA,
  ehDeAgendamento,
  nomeCurtoDaCategoria,
  textoDaEspera,
  type CategoriaDeTemplate,
  type FormatoDeMensagem,
  type MensagemDoTemplate,
  type TemplateDoCliente,
  type UnidadeDeEspera,
} from "@/data/templates";
import {
  adicionarMensagem,
  ativarTemplate,
  criarTemplate,
  editarMensagem,
  excluirTemplate,
  moverMensagem,
  removerMensagem,
} from "@/lib/acoes/templates";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";

/**
 * Os templates de WhatsApp de um cliente, lidos e gravados em
 * `template_categorias`, `templates` e `template_mensagens` — ver
 * `lib/dados/templates.ts` e `lib/acoes/templates.ts`.
 *
 * Cada categoria é um momento do fluxo (atendimento, confirmação, lembrete de
 * 24h e de 2h, reagendamento, cancelamento). Dentro dela, o cliente pode ter
 * vários templates ao longo do tempo, mas só um ativo — é o ativo que a Helô
 * envia. Dentro do template, as mensagens são "bolhas" em ordem, cada uma com
 * a espera que vem antes dela.
 *
 * **Nenhum dado fica em estado desta tela.** As gravações chamam
 * `revalidatePath`, o servidor relê o banco e as props voltam atualizadas —
 * uma cópia local aqui só criaria uma segunda versão da verdade, que
 * discordaria do banco no primeiro erro. O que é estado aqui é só o que a
 * pessoa está digitando.
 *
 * Por isso **toda gravação chama `router.refresh()` quando a ação responde**.
 * O `revalidatePath` da ação limpa o cache do lado do servidor, mas não é ele
 * que garante que esta aba redesenhe: quem limpa o cache do cliente para esta
 * rota e refaz o pedido é o `refresh`, e ele preserva o estado React (o bloco
 * aberto, o formulário no meio, a rolagem). Sem isso, dava para salvar uma
 * bolha e continuar vendo a lista antiga até recarregar a página na mão — foi
 * o que apareceu no teste em produção de 05/11/2026.
 *
 * O refresh acontece em qualquer resultado, inclusive recusa: a ativação e a
 * reordenação podem parar no meio do caminho, com parte do banco já mudada, e
 * aí a tela precisa mostrar o que ficou valendo.
 */

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const botaoLinha =
  "inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors disabled:opacity-50";

const botaoVerde =
  "inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-3.5 py-2 text-xs font-bold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:opacity-50";

const iconeDoFormato: Record<FormatoDeMensagem, typeof MessageSquare> = {
  texto: MessageSquare,
  audio: FileAudio,
  imagem: ImageIcon,
  video: FileVideo,
};

function Erro({ texto }: { texto: string }) {
  if (texto === "") return null;

  return (
    <p className="flex items-center gap-1.5 text-xs font-bold text-herval-vermelho">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {texto}
    </p>
  );
}

export default function GerenciadorTemplates({
  clinicaId,
  categorias,
  templates,
  falha,
}: {
  clinicaId: number | null;
  categorias: CategoriaDeTemplate[];
  templates: TemplateDoCliente[];
  falha: string | null;
}) {
  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-bold text-herval-preto">
          Não deu para carregar os templates.
        </p>
        <p className="mt-1 text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  if (clinicaId === null) {
    return (
      <p className="rounded-controle border border-dashed border-black/20 bg-black/[0.03] px-5 py-4 text-sm font-medium text-black/60">
        Escolha um cliente acima para ver e editar os templates dele. Cada
        cliente tem os seus: é o texto que a Helô manda em nome dele.
      </p>
    );
  }

  if (categorias.length === 0) {
    return (
      <p className="rounded-controle border border-dashed border-black/20 bg-black/[0.03] px-5 py-4 text-sm font-medium text-black/60">
        Nenhuma categoria de template está ativa no banco, então não há onde
        escrever. As categorias são as mesmas para todos os clientes.
      </p>
    );
  }

  /*
    As categorias de agendamento aparecem juntas, debaixo de um cabeçalho só, na
    posição da primeira delas — as três (confirmação, 24h, 2h) são o mesmo
    assunto e separadas ocupariam a tela como se fossem fluxos diferentes. As
    outras seguem soltas, na ordem do banco.
  */
  const deAgendamento = categorias.filter(ehDeAgendamento);
  const primeiraDeAgendamento = categorias.findIndex(ehDeAgendamento);

  return (
    <div className="space-y-8">
      {categorias.map((categoria, indice) => {
        if (ehDeAgendamento(categoria)) {
          if (indice !== primeiraDeAgendamento) return null;

          return (
            <section key="agendamento" className="space-y-4">
              <h2 className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-black/45">
                Agendamento
                <span className="h-px flex-1 bg-black/10" />
                {deAgendamento.length}
              </h2>

              <div className="space-y-5">
                {deAgendamento.map((daVez) => (
                  <CartaoDaCategoria
                    key={daVez.id}
                    categoria={daVez}
                    nome={nomeCurtoDaCategoria(daVez)}
                    clinicaId={clinicaId}
                    templates={templates.filter(
                      (t) => t.categoriaId === daVez.id,
                    )}
                  />
                ))}
              </div>
            </section>
          );
        }

        return (
          <CartaoDaCategoria
            key={categoria.id}
            categoria={categoria}
            nome={categoria.nomeExibicao}
            clinicaId={clinicaId}
            templates={templates.filter((t) => t.categoriaId === categoria.id)}
          />
        );
      })}
    </div>
  );
}

function CartaoDaCategoria({
  categoria,
  nome,
  clinicaId,
  templates,
}: {
  categoria: CategoriaDeTemplate;
  nome: string;
  clinicaId: number;
  templates: TemplateDoCliente[];
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [erro, setErro] = useState("");

  const ativo = templates.find((t) => t.ativo) ?? null;
  const antigos = templates.filter((t) => !t.ativo);

  function criar() {
    if (novoNome.trim() === "") {
      setErro("Dê um nome a este template.");
      return;
    }

    const formData = new FormData();
    formData.set("clinica_id", String(clinicaId));
    formData.set("categoria_id", String(categoria.id));
    formData.set("nome", novoNome.trim());

    iniciarTransicao(async () => {
      const resultado = await criarTemplate(RESULTADO_INICIAL, formData);
      router.refresh();

      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }

      setNovoNome("");
      setErro("");
      setCriando(false);
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-black/[0.03] px-6 py-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-herval-preto">
            {nome}
          </h3>
          {/* A chave é o nome que o n8n usa para achar este template. Fica à
              vista porque é por ela que se confere se a tela e o cérebro estão
              falando da mesma coisa. */}
          <p className="mt-0.5 font-mono text-[11px] font-medium text-black/40">
            {categoria.chave}
          </p>
        </div>

        {ativo === null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-herval-vermelho/40 px-2.5 py-1 text-[11px] font-bold text-herval-vermelho">
            <AlertCircle className="h-3 w-3" />
            Nenhum template ativo: a Helô não tem o que enviar aqui
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-2.5 py-1 text-[11px] font-bold text-herval-preto">
            <Check className="h-3 w-3" />
            No ar: {ativo.nome}
          </span>
        )}
      </div>

      <div className="divide-y divide-black/[0.07]">
        {templates.length === 0 && (
          <p className="px-6 py-6 text-sm font-medium text-black/50">
            Nenhum template nesta categoria ainda.
          </p>
        )}

        {/* `key` pelo id para a tela trocar de instância quando o ativo da
            categoria mudar: sem isso, o template novo herdaria o estado do
            anterior (o bloco aberto, o formulário no meio, o erro antigo). */}
        {ativo && <BlocoDoTemplate key={ativo.id} template={ativo} aberto />}
        {antigos.map((template) => (
          <BlocoDoTemplate key={template.id} template={template} />
        ))}
      </div>

      <div className="space-y-3 border-t border-black/10 px-6 py-4">
        {criando ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder='Nome do template (ex.: "Confirmação - versão curta")'
                className={`${campoBase} sm:w-96`}
              />
              <button
                type="button"
                onClick={criar}
                disabled={pendente}
                className={botaoVerde}
              >
                <Plus className="h-3.5 w-3.5" />
                {pendente ? "Criando…" : "Criar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCriando(false);
                  setNovoNome("");
                  setErro("");
                }}
                disabled={pendente}
                className={`${botaoLinha} hover:border-herval-preto hover:bg-black/5 hover:text-herval-preto`}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
            </div>
            <p className="text-xs font-medium text-black/45">
              Ele nasce desligado. Escreva as mensagens e depois ative — ativar
              um desliga o que estava no ar nesta categoria.
            </p>
            <Erro texto={erro} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
          >
            <Plus className="h-3.5 w-3.5" />
            Criar template nesta categoria
          </button>
        )}
      </div>
    </div>
  );
}

function BlocoDoTemplate({
  template,
  aberto = false,
}: {
  template: TemplateDoCliente;
  aberto?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mostrando, setMostrando] = useState(aberto);
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState("");

  function ativar() {
    const formData = new FormData();
    formData.set("id", String(template.id));

    iniciarTransicao(async () => {
      const resultado = await ativarTemplate(RESULTADO_INICIAL, formData);
      router.refresh();
      setErro(resultado.ok ? "" : resultado.mensagem);
    });
  }

  function excluir() {
    const formData = new FormData();
    formData.set("id", String(template.id));

    iniciarTransicao(async () => {
      const resultado = await excluirTemplate(RESULTADO_INICIAL, formData);
      router.refresh();
      setErro(resultado.ok ? "" : resultado.mensagem);
    });
  }

  return (
    <div className={template.ativo ? "bg-herval-verde/[0.05]" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <button
          type="button"
          onClick={() => setMostrando((atual) => !atual)}
          className="text-left"
        >
          <span className="text-sm font-bold text-herval-preto">
            {template.nome}
          </span>
          <span className="ml-2 text-xs font-medium text-black/45">
            {template.mensagens.length}{" "}
            {template.mensagens.length === 1 ? "mensagem" : "mensagens"}
            {mostrando ? "" : " · mostrar"}
          </span>
        </button>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!template.ativo && (
            <>
              <button
                type="button"
                onClick={ativar}
                disabled={pendente}
                className={`${botaoLinha} hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto`}
              >
                <Power className="h-3.5 w-3.5" />
                {pendente ? "…" : "Ativar"}
              </button>
              <button
                type="button"
                onClick={excluir}
                disabled={pendente}
                className={`${botaoLinha} hover:border-herval-preto hover:bg-herval-preto hover:text-herval-branco`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </>
          )}
        </div>
      </div>

      {erro !== "" && (
        <div className="px-6 pb-4">
          <Erro texto={erro} />
        </div>
      )}

      {mostrando && (
        <div className="border-t border-black/[0.07] bg-black/[0.02]">
          {template.mensagens.length === 0 && !adicionando && (
            <p className="px-6 py-5 text-sm font-medium text-black/50">
              Nenhuma mensagem. Um template sem mensagem não pode ser ativado.
            </p>
          )}

          <div className="divide-y divide-black/[0.07]">
            {template.mensagens.map((mensagem, indice) => (
              <LinhaDaMensagem
                key={mensagem.id}
                templateId={template.id}
                mensagem={mensagem}
                posicao={indice + 1}
                primeira={indice === 0}
                ultima={indice === template.mensagens.length - 1}
              />
            ))}
          </div>

          {adicionando ? (
            <div className="border-t border-black/[0.07] px-6 py-5">
              <FormularioDeMensagem
                templateId={template.id}
                aoFechar={() => setAdicionando(false)}
              />
            </div>
          ) : (
            <div className="border-t border-black/[0.07] px-6 py-4">
              <button
                type="button"
                onClick={() => setAdicionando(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar mensagem
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinhaDaMensagem({
  templateId,
  mensagem,
  posicao,
  primeira,
  ultima,
}: {
  templateId: number;
  mensagem: MensagemDoTemplate;
  posicao: number;
  primeira: boolean;
  ultima: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");

  function mover(direcao: "subir" | "descer") {
    const formData = new FormData();
    formData.set("id", String(mensagem.id));
    formData.set("direcao", direcao);

    iniciarTransicao(async () => {
      const resultado = await moverMensagem(RESULTADO_INICIAL, formData);
      router.refresh();
      setErro(resultado.ok ? "" : resultado.mensagem);
    });
  }

  function remover() {
    const formData = new FormData();
    formData.set("id", String(mensagem.id));

    iniciarTransicao(async () => {
      const resultado = await removerMensagem(RESULTADO_INICIAL, formData);
      router.refresh();
      setErro(resultado.ok ? "" : resultado.mensagem);
    });
  }

  if (editando) {
    return (
      <div className="bg-herval-verde/[0.07] px-6 py-5">
        <FormularioDeMensagem
          templateId={templateId}
          mensagem={mensagem}
          aoFechar={() => setEditando(false)}
        />
      </div>
    );
  }

  const IconeFormato = iconeDoFormato[mensagem.formato];

  return (
    <div className="px-6 py-5">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 shrink-0 text-xs font-bold text-black/35">
          {posicao}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-black/45">
            <IconeFormato className="h-3.5 w-3.5" />
            {NOME_DO_FORMATO[mensagem.formato]}
          </p>

          {mensagem.texto && (
            <p className="mt-2 whitespace-pre-line text-sm text-herval-preto">
              {mensagem.texto}
            </p>
          )}

          {mensagem.midiaUrl && (
            <a
              href={mensagem.midiaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-bold text-herval-preto underline decoration-black/20 underline-offset-2 hover:decoration-herval-verde"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              Abrir o arquivo
            </a>
          )}

          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-black/45">
            <Clock className="h-3.5 w-3.5" />
            Espera de{" "}
            {textoDaEspera(mensagem.delayValor, mensagem.delayUnidade)} antes de
            enviar
          </p>

          <Erro texto={erro} />
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => mover("subir")}
            disabled={pendente || primeira}
            aria-label="Subir esta mensagem"
            className={`${botaoLinha} px-2.5 hover:border-herval-preto hover:bg-black/5`}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => mover("descer")}
            disabled={pendente || ultima}
            aria-label="Descer esta mensagem"
            className={`${botaoLinha} px-2.5 hover:border-herval-preto hover:bg-black/5`}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditando(true)}
            disabled={pendente}
            className={`${botaoLinha} hover:border-herval-verde hover:bg-herval-verde/10 hover:text-herval-preto`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            type="button"
            onClick={remover}
            disabled={pendente}
            className={`${botaoLinha} hover:border-herval-preto hover:bg-herval-preto hover:text-herval-branco`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * O formulário de uma bolha, o mesmo para adicionar e para editar.
 *
 * O arquivo sobe antes de a mensagem ser gravada, pela rota
 * `api/admin/templates/midia` (ver lá por que ela usa a `service_role`). O que
 * fica no formulário é só o endereço que a rota devolveu: gravar é um passo
 * separado, então trocar o arquivo e desistir não deixa a mensagem apontando
 * para o novo.
 */
function FormularioDeMensagem({
  templateId,
  mensagem,
  aoFechar,
}: {
  templateId: number;
  mensagem?: MensagemDoTemplate;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [formato, setFormato] = useState<FormatoDeMensagem>(
    mensagem?.formato ?? "texto",
  );
  const [texto, setTexto] = useState(mensagem?.texto ?? "");
  const [espera, setEspera] = useState(String(mensagem?.delayValor ?? 3));
  const [unidade, setUnidade] = useState<UnidadeDeEspera>(
    mensagem?.delayUnidade ?? "segundos",
  );
  const [midiaUrl, setMidiaUrl] = useState(mensagem?.midiaUrl ?? "");
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [erro, setErro] = useState("");

  const levaArquivo = formato !== "texto";

  async function enviarArquivo(arquivo: File) {
    setEnviandoArquivo(true);
    setErro("");

    const corpo = new FormData();
    corpo.set("template_id", String(templateId));
    corpo.set("formato", formato);
    corpo.set("arquivo", arquivo);

    try {
      const resposta = await fetch("/api/admin/templates/midia", {
        method: "POST",
        body: corpo,
      });
      const dados = (await resposta.json().catch(() => null)) as {
        ok: boolean;
        url?: string;
        motivo?: string;
      } | null;

      if (!resposta.ok || !dados?.ok || !dados.url) {
        setErro(dados?.motivo ?? "Não deu para enviar o arquivo.");
        return;
      }

      setMidiaUrl(dados.url);
    } catch {
      setErro("Não deu para enviar o arquivo. Confira a conexão.");
    } finally {
      setEnviandoArquivo(false);
    }
  }

  function salvar() {
    const formData = new FormData();
    if (mensagem) formData.set("id", String(mensagem.id));
    else formData.set("template_id", String(templateId));

    formData.set("formato", formato);
    formData.set("texto", texto.trim());
    formData.set("delay_valor", espera);
    formData.set("delay_unidade", unidade);
    // Formato texto não leva arquivo: manda vazio para a gravação limpar o
    // endereço de uma mídia que a mensagem tinha antes de virar texto.
    formData.set("midia_url", levaArquivo ? midiaUrl : "");

    iniciarTransicao(async () => {
      const resultado = mensagem
        ? await editarMensagem(RESULTADO_INICIAL, formData)
        : await adicionarMensagem(RESULTADO_INICIAL, formData);
      router.refresh();

      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }

      aoFechar();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FORMATOS_DE_MENSAGEM.map((opcao) => {
          const Icone = iconeDoFormato[opcao];
          const escolhido = opcao === formato;

          return (
            <button
              key={opcao}
              type="button"
              onClick={() => setFormato(opcao)}
              aria-pressed={escolhido}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
                escolhido
                  ? "bg-herval-verde text-herval-preto"
                  : "border border-black/15 text-black/60 hover:bg-black/5 hover:text-herval-preto",
              ].join(" ")}
            >
              <Icone className="h-3.5 w-3.5" />
              {NOME_DO_FORMATO[opcao]}
            </button>
          );
        })}
      </div>

      <textarea
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={
          levaArquivo
            ? "Legenda do arquivo (opcional)"
            : "Texto da mensagem, do jeito que o paciente vai ler"
        }
        className={campoBase}
      />

      {levaArquivo && (
        <div className="space-y-2 rounded-controle border border-dashed border-black/20 bg-black/[0.02] px-4 py-3">
          <label className="flex flex-wrap items-center gap-3 text-xs font-bold text-black/60">
            <Upload className="h-3.5 w-3.5" />
            {midiaUrl === "" ? "Escolher arquivo" : "Trocar arquivo"}
            <input
              type="file"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) void enviarArquivo(arquivo);
              }}
              disabled={enviandoArquivo || pendente}
              className="text-xs font-medium text-black/60 file:mr-3 file:rounded-full file:border file:border-black/15 file:bg-herval-branco file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black/70"
            />
          </label>

          {enviandoArquivo && (
            <p className="text-xs font-bold text-black/50">Enviando arquivo…</p>
          )}

          {midiaUrl !== "" && !enviandoArquivo && (
            <a
              href={midiaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-bold text-herval-preto underline decoration-black/20 underline-offset-2"
            >
              Arquivo enviado: abrir para conferir
            </a>
          )}

          <p className="text-xs font-medium text-black/45">
            O arquivo fica em um endereço público, como as fotos de clínica:
            serve para material de divulgação, não para documento de paciente.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs font-bold text-black/60">
          <Clock className="h-3.5 w-3.5" />
          Espera antes desta mensagem
          <input
            type="number"
            min={0}
            value={espera}
            onChange={(e) => setEspera(e.target.value)}
            className="w-20 rounded-controle border border-black/15 bg-herval-branco px-3 py-1.5 text-sm text-herval-preto outline-none focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
          />
          {/*
            O teto de cada unidade fica na gravação (`ESPERA_MAXIMA`, em
            `lib/acoes/templates.ts`), e não num `max` que muda sozinho ao
            trocar a unidade: o campo não deve apagar o que a pessoa digitou,
            e quem recusa com texto em português é a gravação.
          */}
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as UnidadeDeEspera)}
            aria-label="Unidade de tempo da espera"
            className="rounded-controle border border-black/15 bg-herval-branco px-3 py-1.5 text-sm font-medium text-herval-preto outline-none focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
          >
            {UNIDADES_DE_ESPERA.map((opcao) => (
              <option key={opcao} value={opcao}>
                {NOME_DA_UNIDADE[opcao].plural}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={salvar}
          disabled={pendente || enviandoArquivo}
          className={botaoVerde}
        >
          <Check className="h-3.5 w-3.5" />
          {pendente ? "Salvando…" : mensagem ? "Salvar" : "Adicionar"}
        </button>

        <button
          type="button"
          onClick={aoFechar}
          disabled={pendente}
          className={`${botaoLinha} hover:border-herval-preto hover:bg-black/5 hover:text-herval-preto`}
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </button>
      </div>

      <Erro texto={erro} />
    </div>
  );
}
