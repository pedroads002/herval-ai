import { Fragment } from "react";
import { Bot, User, Zap, Clock, BarChart3, PauseCircle } from "lucide-react";
import {
  gruposTemplate,
  grupoDoTemplate,
  templatesIniciais,
  type Template,
} from "@/data/templates";
import { regrasIniciais, type ExecutorRegra } from "@/data/reguaAutomacao";
import { formatarNumero } from "@/lib/formato";

const iconeExecutor: Record<ExecutorRegra, typeof Bot> = {
  IA: Bot,
  Humano: User,
  Automática: Zap,
};

/** Destaca as variáveis {{assim}} dentro do texto da mensagem. */
function TextoComVariaveis({ texto }: { texto: string }) {
  const partes = texto.split(/(\{\{\w+\}\})/g);

  return (
    <p className="text-sm leading-relaxed text-black/75">
      {partes.map((parte, indice) =>
        /^\{\{\w+\}\}$/.test(parte) ? (
          <span
            key={indice}
            className="rounded bg-herval-verde/20 px-1 font-bold text-herval-preto"
          >
            {parte}
          </span>
        ) : (
          <Fragment key={indice}>{parte}</Fragment>
        ),
      )}
    </p>
  );
}

function CartaoTemplate({ template }: { template: Template }) {
  const regra = regrasIniciais.find((r) => r.id === template.regraId);
  const executor = regra?.executor ?? "IA";
  const IconeExec = iconeExecutor[executor];
  const humano = executor === "Humano";
  const pausada = regra ? !regra.ativo : false;

  return (
    <article className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-herval-preto">
            {template.fluxo}
          </h3>
          {regra && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-black/50">
              <span>{regra.gatilho}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {regra.espera}
              </span>
            </p>
          )}
        </div>

        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
            humano
              ? "bg-herval-preto text-herval-branco"
              : "border border-black/20 text-black/60",
          ].join(" ")}
        >
          <IconeExec className="h-3 w-3" />
          {executor}
        </span>
      </div>

      <div className="mt-4 rounded-controle bg-black/[0.03] p-4">
        <TextoComVariaveis texto={template.texto} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-black/50">
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="font-extrabold text-herval-preto">
            {formatarNumero(template.usos)}
          </span>{" "}
          envios
        </span>

        {pausada && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-black/60">
            <PauseCircle className="h-3.5 w-3.5" />
            Regra desligada na Régua: não está sendo enviado
          </span>
        )}

        {humano && (
          <span className="text-xs font-bold text-herval-preto">
            A IA não envia: o texto fica pronto para a CRC usar
          </span>
        )}
      </div>
    </article>
  );
}

export default function ListaTemplates() {
  const enviadosPelaIa = templatesIniciais.filter((t) => {
    const regra = regrasIniciais.find((r) => r.id === t.regraId);
    return regra?.executor !== "Humano";
  }).length;

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">
          {templatesIniciais.length}
        </span>{" "}
        templates ·{" "}
        <span className="font-extrabold text-herval-preto">
          {enviadosPelaIa}
        </span>{" "}
        enviados pela automação. O que está entre chaves é trocado pelo dado do
        lead na hora do envio.
      </p>

      {gruposTemplate.map((grupo) => {
        const doGrupo = templatesIniciais.filter(
          (t) => grupoDoTemplate[t.id] === grupo,
        );
        if (doGrupo.length === 0) return null;

        return (
          <section key={grupo} className="space-y-4">
            <h2 className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-black/45">
              {grupo}
              <span className="h-px flex-1 bg-black/10" />
              {doGrupo.length}
            </h2>

            <div className="grid gap-5 lg:grid-cols-2">
              {doGrupo.map((template) => (
                <CartaoTemplate key={template.id} template={template} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-xs font-medium text-black/45">
        Cada template está ligado a uma regra da Régua de Automação: o gatilho e
        a espera vêm de lá. Desligar a regra na Régua interrompe o envio do
        texto correspondente.
      </p>
    </div>
  );
}
