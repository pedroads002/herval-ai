import {
  AlertCircle,
  Check,
  Clock,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  MessageSquare,
  Upload,
} from "lucide-react";
import {
  NOME_DO_FORMATO,
  ehDeAgendamento,
  nomeCurtoDaCategoria,
  textoDaEspera,
  type CategoriaDeTemplate,
  type FormatoDeMensagem,
  type MensagemDoTemplate,
  type TemplateDoCliente,
} from "@/data/templates";

/**
 * Os templates de WhatsApp do próprio cliente, só para ver.
 *
 * É a mesma leitura do `GerenciadorTemplates` (ver `lib/dados/templates.ts`),
 * mostrada sem nenhum caminho de gravação. Quem escreve o que a Helô manda em
 * nome do cliente continua sendo a agência, na tela dela; o cliente abre esta
 * para conferir o texto que sai no nome dele.
 *
 * **Os controles não estão desabilitados aqui: eles não existem.** Este é um
 * arquivo separado do `GerenciadorTemplates` de propósito. Um modo "somente
 * leitura" por dentro daquele componente deixaria os sete botões de gravação a
 * um `if` de distância de voltar para a tela do cliente, e as Server Actions
 * importadas no mesmo arquivo. Aqui não há `"use client"`, não há estado, e
 * `lib/acoes/templates` não é importado — não há o que esconder.
 *
 * A tranca de verdade não é esta tela e nem o menu: as políticas de `templates`
 * e `template_mensagens` dão ao papel de cliente apenas o SELECT da própria
 * `clinica_id` (`somente_herval` cobre INSERT/UPDATE/DELETE). Mesmo que esta
 * tela tivesse um botão, o banco recusaria.
 *
 * Os templates antigos ficam dentro de um `<details>` nativo em vez de um
 * botão com estado: o que interessa ao cliente é o que está no ar, e um
 * `<details>` abre sem transformar este arquivo em componente de navegador.
 */

const iconeDoFormato: Record<FormatoDeMensagem, typeof MessageSquare> = {
  texto: MessageSquare,
  audio: FileAudio,
  imagem: ImageIcon,
  video: FileVideo,
};

export default function VisaoDeTemplates({
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

  // Cliente sem clínica na autorização não chega aqui — a página manda para a
  // Visão Geral antes. A mensagem existe para o caso não acontecer calado.
  if (clinicaId === null) {
    return (
      <p className="rounded-controle border border-dashed border-black/20 bg-black/[0.03] px-5 py-4 text-sm font-medium text-black/60">
        Sua conta não está vinculada a nenhuma clínica, então não há templates
        para mostrar. Avise a Herval.
      </p>
    );
  }

  if (categorias.length === 0) {
    return (
      <p className="rounded-controle border border-dashed border-black/20 bg-black/[0.03] px-5 py-4 text-sm font-medium text-black/60">
        Nenhuma categoria de template está ativa, então não há mensagem
        configurada para mostrar.
      </p>
    );
  }

  // O mesmo agrupamento da tela da agência: confirmação, 24h e 2h são o mesmo
  // assunto e aparecem debaixo de um cabeçalho só, na posição da primeira.
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
                    nome={nomeCurtoDaCategoria(daVez)}
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
            nome={categoria.nomeExibicao}
            templates={templates.filter((t) => t.categoriaId === categoria.id)}
          />
        );
      })}
    </div>
  );
}

/**
 * Uma categoria — um momento do fluxo. A `chave` técnica não aparece aqui, ao
 * contrário da tela da agência: ela serve para conferir tela e cérebro, não
 * para o cliente.
 */
function CartaoDaCategoria({
  nome,
  templates,
}: {
  nome: string;
  templates: TemplateDoCliente[];
}) {
  const ativo = templates.find((t) => t.ativo) ?? null;
  const antigos = templates.filter((t) => !t.ativo);

  return (
    <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-black/[0.03] px-6 py-4">
        <h3 className="text-sm font-extrabold tracking-tight text-herval-preto">
          {nome}
        </h3>

        {ativo === null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-herval-vermelho/40 px-2.5 py-1 text-[11px] font-bold text-herval-vermelho">
            <AlertCircle className="h-3 w-3" />
            Nenhuma mensagem configurada aqui
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde px-2.5 py-1 text-[11px] font-bold text-herval-preto">
            <Check className="h-3 w-3" />
            No ar: {ativo.nome}
          </span>
        )}
      </div>

      {ativo === null ? (
        <p className="px-6 py-6 text-sm font-medium text-black/50">
          A Helô não tem mensagem para enviar neste momento do fluxo. Se isso
          não era o esperado, avise a Herval.
        </p>
      ) : (
        <ListaDeMensagens mensagens={ativo.mensagens} />
      )}

      {antigos.length > 0 && (
        <details className="border-t border-black/10 bg-black/[0.02]">
          <summary className="cursor-pointer px-6 py-4 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto">
            {antigos.length === 1
              ? "Ver 1 versão anterior"
              : `Ver ${antigos.length} versões anteriores`}
          </summary>

          <div className="divide-y divide-black/[0.07] border-t border-black/[0.07]">
            {antigos.map((template) => (
              <div key={template.id}>
                <p className="px-6 pt-4 text-sm font-bold text-black/55">
                  {template.nome}
                  <span className="ml-2 text-xs font-medium text-black/40">
                    fora do ar
                  </span>
                </p>
                <ListaDeMensagens mensagens={template.mensagens} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ListaDeMensagens({ mensagens }: { mensagens: MensagemDoTemplate[] }) {
  if (mensagens.length === 0) {
    return (
      <p className="px-6 py-5 text-sm font-medium text-black/50">
        Nenhuma mensagem neste template.
      </p>
    );
  }

  return (
    <div className="divide-y divide-black/[0.07]">
      {mensagens.map((mensagem, indice) => (
        <Bolha key={mensagem.id} mensagem={mensagem} posicao={indice + 1} />
      ))}
    </div>
  );
}

/** Uma bolha: o que a Helô manda, na ordem em que manda. */
function Bolha({
  mensagem,
  posicao,
}: {
  mensagem: MensagemDoTemplate;
  posicao: number;
}) {
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
        </div>
      </div>
    </div>
  );
}
