"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check } from "lucide-react";
import { tiposDeProfissional } from "@/lib/dados/tiposDeProfissional";
import { estados } from "@/lib/dados/estados";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";
import type {
  EspecialidadeDoCadastro,
  HorarioNaUnidade,
} from "@/lib/dados/profissionais";

/**
 * As peças que as telas do cadastro de clientes dividem entre si.
 *
 * Existem aqui, e não copiadas em cada tela, porque o mesmo bloco de campos
 * aparece três vezes — ao cadastrar um cliente, ao editar um cliente e ao
 * cadastrar ou editar quem atende nele. Três cópias ficariam diferentes na
 * primeira vez que alguém mudasse um rótulo em uma só.
 *
 * O desenho é o do resto do painel: cartão arredondado, etiqueta arredondada,
 * verde da Herval no que está marcado. Nada de visual novo foi inventado.
 */

export const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

export const botaoPrincipal =
  "inline-flex items-center gap-2 rounded-full bg-herval-verde px-5 py-3 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:opacity-50";

export const botaoSecundario =
  "inline-flex items-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-bold text-black/70 transition-colors hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40";

export const botaoPerigo =
  "inline-flex items-center gap-2 rounded-full border border-herval-vermelho/40 px-5 py-3 text-sm font-bold text-herval-vermelho transition-colors hover:bg-herval-vermelho/5 disabled:cursor-not-allowed disabled:opacity-40";

export const rotulo =
  "mb-2 block text-xs font-bold uppercase tracking-wide text-black/50";

/** O texto de todos os campos de uma vez, indexado pelo nome do campo. */
export type Valores = Record<string, string>;

/** Muda um campo só, sem tocar nos outros. */
export function useValores(iniciais: Valores) {
  const [valores, setValores] = useState<Valores>(iniciais);
  const mudar = (campo: string, valor: string) =>
    setValores((atual) => ({ ...atual, [campo]: valor }));
  return { valores, mudar };
}

/** As caixas marcadas, indexadas por `campo-valor`. */
export type Marcados = Record<string, boolean>;

export function useMarcados(iniciais: Marcados) {
  const [marcados, setMarcados] = useState<Marcados>(iniciais);
  return { marcados, setMarcados };
}

/** Monta o estado inicial das caixas a partir dos ids já gravados. */
export function marcarIds(campo: string, ids: number[]): Marcados {
  return Object.fromEntries(ids.map((id) => [`${campo}-${id}`, true]));
}

export function Campo({
  nome,
  etiqueta,
  valores,
  aoMudar,
  obrigatorio,
  exemplo,
  ajuda,
  tipo = "text",
  limite = 120,
}: {
  nome: string;
  etiqueta: string;
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
  obrigatorio?: boolean;
  exemplo?: string;
  ajuda?: string;
  tipo?: "text" | "email";
  limite?: number;
}) {
  const id = `campo-${nome}`;

  return (
    <div>
      <label htmlFor={id} className={rotulo}>
        {etiqueta}
        {!obrigatorio && <span className="normal-case"> (opcional)</span>}
      </label>
      <input
        id={id}
        name={nome}
        type={tipo}
        maxLength={limite}
        autoComplete="off"
        placeholder={exemplo}
        value={valores[nome] ?? ""}
        onChange={(e) => aoMudar(nome, e.target.value)}
        className={campoBase}
      />
      {ajuda && (
        <p className="mt-2 text-xs font-medium text-black/45">{ajuda}</p>
      )}
    </div>
  );
}

export function Escolher({
  nome,
  etiqueta,
  opcoes,
  vazio,
  valores,
  aoMudar,
}: {
  nome: string;
  etiqueta: string;
  opcoes: readonly string[];
  vazio: string;
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
}) {
  const id = `campo-${nome}`;

  return (
    <div>
      <label htmlFor={id} className={rotulo}>
        {etiqueta}
      </label>
      <select
        id={id}
        name={nome}
        value={valores[nome] ?? ""}
        onChange={(e) => aoMudar(nome, e.target.value)}
        className={campoBase}
      >
        <option value="" disabled>
          {vazio}
        </option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Descricao({
  valores,
  aoMudar,
}: {
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
}) {
  return (
    <div>
      <label htmlFor="campo-descricao" className={rotulo}>
        Descrição curta <span className="normal-case">(opcional)</span>
      </label>
      <textarea
        id="campo-descricao"
        name="descricao"
        rows={3}
        maxLength={600}
        placeholder="Em uma ou duas frases, quem é este cliente."
        value={valores.descricao ?? ""}
        onChange={(e) => aoMudar("descricao", e.target.value)}
        className={campoBase}
      />
    </div>
  );
}

/**
 * Ativo ou inativo.
 *
 * É uma caixa marcada, e não dois botões de rádio, porque o estado normal é
 * ativo: quem cadastra um cliente está cadastrando alguém que vai ser
 * atendido. Desmarcar é a exceção, e exceção merece um clique, não dois.
 */
/**
 * `palavras` existe por concordância: "unidade" é feminino, e o padrão
 * masculino viraria "Unidade ... Ativo" ao lado de uma etiqueta que diz
 * "Inativa" na mesma tela.
 */
export function Status({
  nome,
  etiqueta,
  ligado,
  aoMudar,
  palavras = ["Ativo", "Inativo"],
}: {
  nome: string;
  etiqueta: string;
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
  palavras?: [string, string];
}) {
  return (
    <div>
      <p className={rotulo}>{etiqueta}</p>
      <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-black/15 px-4 py-2.5 text-xs font-bold text-black/70 transition-colors has-[:checked]:border-herval-verde has-[:checked]:bg-herval-verde/15 has-[:checked]:text-herval-preto">
        <input
          type="checkbox"
          name={nome}
          checked={ligado}
          onChange={(e) => aoMudar(e.target.checked)}
          className="h-3.5 w-3.5 accent-herval-verde"
        />
        {ligado ? palavras[0] : palavras[1]}
      </label>
    </div>
  );
}

/**
 * Uma caixa de marcar com cara de etiqueta, igual às da tabela. Controlada,
 * pelo mesmo motivo dos campos de texto: o que foi marcado precisa sobreviver
 * a um erro de validação, que esvazia o formulário.
 */
export function Marcador({
  campo,
  valor,
  texto,
  marcados,
  aoMarcar,
}: {
  campo: string;
  valor: number;
  texto: string;
  marcados: Marcados;
  aoMarcar: (mudar: (atual: Marcados) => Marcados) => void;
}) {
  const chave = `${campo}-${valor}`;

  return (
    <label className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors has-[:checked]:border-herval-verde has-[:checked]:bg-herval-verde/15 has-[:checked]:text-herval-preto">
      <input
        type="checkbox"
        name={campo}
        value={valor}
        checked={marcados[chave] ?? false}
        onChange={(e) =>
          aoMarcar((atual) => ({ ...atual, [chave]: e.target.checked }))
        }
        className="h-3.5 w-3.5 accent-herval-verde"
      />
      {texto}
    </label>
  );
}

/**
 * Os procedimentos que a pessoa realiza.
 *
 * "Outro" não é uma linha do catálogo: é uma caixa que abre um campo de texto.
 * Virar linha no catálogo encheria a lista de variações da mesma coisa
 * digitadas por gente diferente, e aí ninguém mais consegue dizer quantos
 * profissionais fazem determinado procedimento.
 *
 * Procedimento inativo não entra na lista de marcar. Ele continua aparecendo
 * riscado em quem já o tinha — o histórico não se apaga —, mas oferecê-lo num
 * cadastro novo seria convidar a marcar algo que saiu de catálogo.
 */
export function Procedimentos({
  especialidades,
  marcados,
  aoMarcar,
  valores,
  aoMudar,
}: {
  especialidades: EspecialidadeDoCadastro[];
  marcados: Marcados;
  aoMarcar: (mudar: (atual: Marcados) => Marcados) => void;
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
}) {
  const disponiveis = especialidades.filter((e) => e.ativa);
  const [temOutro, setTemOutro] = useState(
    (valores.procedimento_outro ?? "") !== "",
  );

  return (
    <fieldset>
      <legend className={rotulo}>Procedimentos / tratamentos realizados</legend>
      {disponiveis.length === 0 ? (
        <p className="text-sm font-medium text-black/45">
          Nenhum procedimento ativo no catálogo ainda.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {disponiveis.map((especialidade) => (
            <Marcador
              key={especialidade.id}
              campo="especialidades"
              valor={especialidade.id}
              texto={especialidade.nome}
              marcados={marcados}
              aoMarcar={aoMarcar}
            />
          ))}

          <label className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors has-[:checked]:border-herval-verde has-[:checked]:bg-herval-verde/15 has-[:checked]:text-herval-preto">
            <input
              type="checkbox"
              checked={temOutro}
              onChange={(e) => {
                setTemOutro(e.target.checked);
                // Desmarcar apaga o que estava escrito. Guardar um texto que
                // não aparece mais na tela faria o cadastro gravar um
                // procedimento que quem cadastrou acha que tirou.
                if (!e.target.checked) aoMudar("procedimento_outro", "");
              }}
              className="h-3.5 w-3.5 accent-herval-verde"
            />
            Outro
          </label>
        </div>
      )}

      {temOutro && (
        <div className="mt-4 max-w-xl">
          <Campo
            nome="procedimento_outro"
            etiqueta="Qual procedimento/tratamento?"
            valores={valores}
            aoMudar={aoMudar}
            obrigatorio
            exemplo="Ex.: Toxina botulínica"
          />
        </div>
      )}
    </fieldset>
  );
}

/**
 * O formulário de quem atende sozinho: cliente e pessoa num bloco só.
 *
 * Os dois caminhos não têm o mesmo formulário porque não têm as mesmas
 * perguntas. Aqui o nome da pessoa **é** o nome do cliente, e a especialidade
 * principal e os procedimentos são dela — juntar os dois blocos prontos faria
 * a tela pedir o nome duas vezes, que é exatamente o que este caminho existe
 * para evitar.
 */
export function CamposDoIndividual({
  valores,
  aoMudar,
  ativa,
  aoMudarStatus,
  marcados,
  aoMarcar,
  especialidades,
}: {
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
  ativa: boolean;
  aoMudarStatus: (ligado: boolean) => void;
  marcados: Marcados;
  aoMarcar: (mudar: (atual: Marcados) => Marcados) => void;
  especialidades: EspecialidadeDoCadastro[];
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-7">
        <p className={rotulo}>Dados principais</p>

        <div className="grid gap-5 md:grid-cols-3">
          <Campo
            nome="nome"
            etiqueta="Nome"
            valores={valores}
            aoMudar={aoMudar}
            obrigatorio
            exemplo="Ex.: Ana Martins"
          />
          <Campo
            nome="nome_exibicao"
            etiqueta="Nome profissional / como deve ser chamado"
            valores={valores}
            aoMudar={aoMudar}
            obrigatorio
            exemplo="Ex.: Dra. Ana"
          />
          <Escolher
            nome="area_atuacao"
            etiqueta="Área de atuação"
            opcoes={tiposDeProfissional}
            vazio="Escolha a área"
            valores={valores}
            aoMudar={aoMudar}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            nome="especialidade_principal"
            etiqueta="Especialidade principal"
            valores={valores}
            aoMudar={aoMudar}
            obrigatorio
            exemplo="Ex.: Harmonização facial"
          />
          {/* O registro não está na especificação, mas já existia no cadastro
              e já tem coluna no banco. Tirá-lo apagaria uma informação que a
              agência vinha guardando; fica opcional, como sempre foi. */}
          <Campo
            nome="registro"
            etiqueta="Registro"
            valores={valores}
            aoMudar={aoMudar}
            limite={60}
            exemplo="Ex.: CRM 12345"
            ajuda="Nem todo cargo tem conselho de classe."
          />
        </div>

        <Procedimentos
          especialidades={especialidades}
          marcados={marcados}
          aoMarcar={aoMarcar}
          valores={valores}
          aoMudar={aoMudar}
        />

        <div className="grid gap-5 md:grid-cols-3">
          <Campo
            nome="whatsapp"
            etiqueta="WhatsApp"
            valores={valores}
            aoMudar={aoMudar}
            obrigatorio
            exemplo="Ex.: (51) 99999-0000"
            ajuda="É por este número que a Helô fala com o cliente."
          />
          <Campo
            nome="email"
            etiqueta="E-mail"
            tipo="email"
            valores={valores}
            aoMudar={aoMudar}
            exemplo="Ex.: ana@clinica.com.br"
          />
          <Campo
            nome="instagram"
            etiqueta="Instagram"
            valores={valores}
            aoMudar={aoMudar}
            exemplo="Ex.: @draanamartins"
          />
        </div>
      </div>

      <div className="space-y-7 border-t border-black/10 pt-7">
        <p className={rotulo}>Localização</p>
        <div className="grid gap-5 md:grid-cols-3">
          <Campo
            nome="cidade"
            etiqueta="Cidade"
            valores={valores}
            aoMudar={aoMudar}
            obrigatorio
            exemplo="Ex.: Porto Alegre"
          />
          <Escolher
            nome="estado"
            etiqueta="Estado"
            opcoes={estados}
            vazio="UF"
            valores={valores}
            aoMudar={aoMudar}
          />
          <Campo
            nome="endereco"
            etiqueta="Endereço de atendimento"
            valores={valores}
            aoMudar={aoMudar}
            limite={240}
            exemplo="Ex.: Av. Ipiranga, 100 · sala 3"
          />
        </div>
      </div>

      <div className="space-y-7 border-t border-black/10 pt-7">
        <p className={rotulo}>Informações adicionais</p>
        <Descricao valores={valores} aoMudar={aoMudar} />
        <Status
          nome="ativa"
          etiqueta="Status"
          ligado={ativa}
          aoMudar={aoMudarStatus}
        />
        {/* Quem atende sozinho é o cliente: um só status, gravado nos dois
            lugares. Dois interruptores para a mesma pessoa deixariam o
            cadastro dizer que o cliente está ativo e ninguém atende nele. */}
        {ativa && <input type="hidden" name="ativo" value="1" />}
      </div>
    </div>
  );
}

/** Os campos de identificação e contato do cliente. */
export function CamposDoCliente({
  tipoOperacao,
  valores,
  aoMudar,
  ativa,
  aoMudarStatus,
}: {
  tipoOperacao: "individual" | "equipe";
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
  ativa: boolean;
  aoMudarStatus: (ligado: boolean) => void;
}) {
  const equipe = tipoOperacao === "equipe";

  return (
    <div className="space-y-7">
      <div className="grid gap-5 md:grid-cols-3">
        <Campo
          nome="nome"
          etiqueta={equipe ? "Nome da clínica / marca" : "Nome"}
          valores={valores}
          aoMudar={aoMudar}
          obrigatorio
          exemplo={equipe ? "Ex.: Clínica Bella Face" : "Ex.: Ana Martins"}
        />

        {equipe ? (
          <Campo
            nome="responsavel_principal"
            etiqueta="Responsável principal"
            valores={valores}
            aoMudar={aoMudar}
            obrigatorio
            exemplo="Ex.: Dra. Ana Martins"
          />
        ) : (
          <Campo
            nome="nome_exibicao"
            etiqueta="Nome profissional / como deve ser chamado"
            valores={valores}
            aoMudar={aoMudar}
            obrigatorio
            exemplo="Ex.: Dra. Ana"
          />
        )}

        <Escolher
          nome="area_atuacao"
          etiqueta="Área de atuação"
          opcoes={tiposDeProfissional}
          vazio="Escolha a área"
          valores={valores}
          aoMudar={aoMudar}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Campo
          nome="whatsapp"
          etiqueta="WhatsApp"
          valores={valores}
          aoMudar={aoMudar}
          obrigatorio
          exemplo="Ex.: (51) 99999-0000"
          ajuda="É por este número que a Helô fala com o cliente."
        />
        <Campo
          nome="email"
          etiqueta="E-mail"
          tipo="email"
          valores={valores}
          aoMudar={aoMudar}
          exemplo="Ex.: contato@clinica.com.br"
        />
        <Campo
          nome="instagram"
          etiqueta="Instagram"
          valores={valores}
          aoMudar={aoMudar}
          exemplo="Ex.: @clinicabellaface"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Campo
          nome="cidade"
          etiqueta="Cidade"
          valores={valores}
          aoMudar={aoMudar}
          obrigatorio
          exemplo="Ex.: Porto Alegre"
        />
        <Escolher
          nome="estado"
          etiqueta="Estado"
          opcoes={estados}
          vazio="UF"
          valores={valores}
          aoMudar={aoMudar}
        />
        <Campo
          nome="endereco"
          etiqueta="Endereço de atendimento"
          valores={valores}
          aoMudar={aoMudar}
          limite={240}
          exemplo="Ex.: Av. Ipiranga, 100 · sala 3"
        />
      </div>

      <Descricao valores={valores} aoMudar={aoMudar} />

      <Status
        nome="ativa"
        etiqueta={equipe ? "Status da operação" : "Status"}
        ligado={ativa}
        aoMudar={aoMudarStatus}
      />
    </div>
  );
}

/** Os campos da pessoa que atende. Iguais nos dois caminhos. */
export function CamposDaPessoa({
  valores,
  aoMudar,
  ativo,
  aoMudarStatus,
  marcados,
  aoMarcar,
  especialidades,
  comStatus = true,
}: {
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
  ativo: boolean;
  aoMudarStatus: (ligado: boolean) => void;
  marcados: Marcados;
  aoMarcar: (mudar: (atual: Marcados) => Marcados) => void;
  especialidades: EspecialidadeDoCadastro[];
  comStatus?: boolean;
}) {
  return (
    <div className="space-y-7">
      <div className="grid gap-5 md:grid-cols-2">
        <Campo
          nome="nome"
          etiqueta="Nome"
          valores={valores}
          aoMudar={aoMudar}
          obrigatorio
          exemplo="Ex.: Ana Martins"
        />
        <Campo
          nome="nome_exibicao"
          etiqueta="Como deve ser chamado"
          valores={valores}
          aoMudar={aoMudar}
          obrigatorio
          exemplo="Ex.: Dra. Ana"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Campo
          nome="especialidade_principal"
          etiqueta="Especialidade principal"
          valores={valores}
          aoMudar={aoMudar}
          obrigatorio
          exemplo="Ex.: Harmonização facial"
        />
        {/* O registro não está na especificação, mas já existia no cadastro e
            já tem coluna no banco. Tirá-lo apagaria uma informação que a
            agência vinha guardando; fica opcional, como sempre foi. */}
        <Campo
          nome="registro"
          etiqueta="Registro"
          valores={valores}
          aoMudar={aoMudar}
          limite={60}
          exemplo="Ex.: CRM 12345"
          ajuda="Nem todo cargo tem conselho de classe."
        />
      </div>

      <Procedimentos
        especialidades={especialidades}
        marcados={marcados}
        aoMarcar={aoMarcar}
        valores={valores}
        aoMudar={aoMudar}
      />

      {comStatus && (
        <Status
          nome="ativo"
          etiqueta="Status"
          ligado={ativo}
          aoMudar={aoMudarStatus}
        />
      )}
    </div>
  );
}

/**
 * Onde a pessoa atende.
 *
 * Três casos, e a diferença entre eles não é enfeite:
 *
 *   sem lista       o cliente nasce na mesma gravação, então não existe nada
 *                   para escolher ainda.
 *   uma unidade só  a escolha seria entre uma opção e nenhuma. Vira um campo
 *                   escondido — quem tem um lugar só nunca precisa saber que
 *                   "unidade" existe.
 *   mais de uma     aí sim é uma escolha, e aparece como escolha.
 */
export function Unidades({
  unidades,
  marcados,
  aoMarcar,
}: {
  unidades: { id: number; nome: string }[] | null;
  marcados: Marcados;
  aoMarcar: (mudar: (atual: Marcados) => Marcados) => void;
}) {
  if (unidades === null || unidades.length === 0) return null;

  if (unidades.length === 1) {
    return <input type="hidden" name="unidades" value={unidades[0].id} />;
  }

  return (
    <fieldset>
      <legend className={rotulo}>Em qual unidade atende</legend>
      <div className="flex flex-wrap gap-2">
        {unidades.map((unidade) => (
          <Marcador
            key={unidade.id}
            campo="unidades"
            valor={unidade.id}
            texto={unidade.nome}
            marcados={marcados}
            aoMarcar={aoMarcar}
          />
        ))}
      </div>
      <p className="mt-2 text-xs font-medium text-black/45">
        Dá para marcar mais de uma, se a pessoa atende em mais de um lugar.
      </p>
    </fieldset>
  );
}

/**
 * Os dias da semana, na ordem em que se fala e com o número que o banco guarda.
 *
 * `1` é segunda e `7` é domingo — a numeração do CHECK da tabela, que é a mesma
 * do `isodow` do Postgres. Começar na segunda e não no domingo é o que a agência
 * usa: fim de semana fica no fim, onde a exceção deve ficar.
 */
const DIAS_DA_SEMANA = [
  { valor: 1, nome: "Seg" },
  { valor: 2, nome: "Ter" },
  { valor: 3, nome: "Qua" },
  { valor: 4, nome: "Qui" },
  { valor: 5, nome: "Sex" },
  { valor: 6, nome: "Sáb" },
  { valor: 7, nome: "Dom" },
] as const;

/**
 * O horário em uma linha, para quem só está olhando a lista.
 *
 * Devolve texto vazio quando não há nada informado — a tela usa isso para não
 * desenhar uma linha que diria "—". Dia sem hora e hora sem dia são dois casos
 * possíveis e cada um aparece sozinho: quem informou só os dias informou uma
 * coisa verdadeira, e inventar o resto seria pior.
 */
export function textoDoHorario(horario: HorarioNaUnidade) {
  const dias = DIAS_DA_SEMANA.filter((d) => horario.dias.includes(d.valor))
    .map((d) => d.nome)
    .join(", ");
  const horas =
    horario.inicio && horario.fim ? `${horario.inicio}–${horario.fim}` : "";

  return [dias, horas].filter(Boolean).join(" · ");
}

/** O estado inicial das caixas de dia, a partir do que já está gravado. */
export function marcadosDoHorario(horarios: HorarioNaUnidade[]): Marcados {
  return Object.fromEntries(
    horarios.flatMap((h) =>
      h.dias.map((dia) => [`horario-${h.unidadeId}-dias-${dia}`, true]),
    ),
  );
}

/** O texto inicial dos campos de hora, a partir do que já está gravado. */
export function valoresDoHorario(horarios: HorarioNaUnidade[]): Valores {
  return Object.fromEntries(
    horarios.flatMap((h) => [
      [`horario-${h.unidadeId}-inicio`, h.inicio ?? ""],
      [`horario-${h.unidadeId}-fim`, h.fim ?? ""],
    ]),
  );
}

/**
 * Quando a pessoa atende em cada lugar.
 *
 * Um bloco por unidade marcada, porque o horário é de um par pessoa-lugar: quem
 * atende na matriz às segundas e na filial às quintas não tem "um" horário. O
 * bloco aparece e desaparece junto com a marca da unidade — sem isso, alguém
 * preencheria o horário de um lugar onde a pessoa não atende e a gravação
 * jogaria fora o que foi digitado, sem dizer nada.
 *
 * Tudo opcional, de propósito. A maior parte dos clientes combina horário por
 * WhatsApp, caso a caso, e obrigar a preencher uma agenda que não existe só
 * produziria horário inventado — que é pior que campo vazio, porque o sistema
 * passaria a acreditar nele.
 */
export function HorariosNasUnidades({
  unidades,
  marcados,
  aoMarcar,
  valores,
  aoMudar,
}: {
  unidades: { id: number; nome: string }[] | null;
  marcados: Marcados;
  aoMarcar: (mudar: (atual: Marcados) => Marcados) => void;
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
}) {
  if (unidades === null || unidades.length === 0) return null;

  // Com uma unidade só não existe o que marcar: a tela manda o lugar num campo
  // escondido, e o horário é o horário dela.
  const escolhidas =
    unidades.length === 1
      ? unidades
      : unidades.filter((u) => marcados[`unidades-${u.id}`]);

  if (escolhidas.length === 0) return null;

  return (
    <fieldset>
      <legend className={rotulo}>Dias e horário de atendimento</legend>
      <div className="space-y-4">
        {escolhidas.map((unidade) => (
          <div
            key={unidade.id}
            className="rounded-card border border-black/10 px-5 py-4"
          >
            {unidades.length > 1 && (
              <p className="mb-3 text-xs font-bold text-herval-preto">
                {unidade.nome}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {DIAS_DA_SEMANA.map((dia) => (
                <Marcador
                  key={dia.valor}
                  campo={`horario-${unidade.id}-dias`}
                  valor={dia.valor}
                  texto={dia.nome}
                  marcados={marcados}
                  aoMarcar={aoMarcar}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-black/50">
              <span>das</span>
              <Hora
                nome={`horario-${unidade.id}-inicio`}
                etiqueta={`Hora de início em ${unidade.nome}`}
                valores={valores}
                aoMudar={aoMudar}
              />
              <span>às</span>
              <Hora
                nome={`horario-${unidade.id}-fim`}
                etiqueta={`Hora de fim em ${unidade.nome}`}
                valores={valores}
                aoMudar={aoMudar}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs font-medium text-black/45">
        Pode deixar em branco. A Helô só usa isso quando estiver informado.
      </p>
    </fieldset>
  );
}

/**
 * Um campo de hora.
 *
 * `type="time"` em vez de texto com máscara: o navegador já sabe recusar
 * "25:70", e no celular ele abre o seletor de hora em vez do teclado inteiro.
 * A etiqueta fica escondida porque a frase "das __ às __" ao lado já diz o que
 * o campo é — para quem lê a tela com leitor de tela, ela não diria nada.
 */
function Hora({
  nome,
  etiqueta,
  valores,
  aoMudar,
}: {
  nome: string;
  etiqueta: string;
  valores: Valores;
  aoMudar: (campo: string, valor: string) => void;
}) {
  return (
    <input
      type="time"
      name={nome}
      aria-label={etiqueta}
      value={valores[nome] ?? ""}
      onChange={(e) => aoMudar(nome, e.target.value)}
      className="rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
    />
  );
}

export function Cartao({
  titulo,
  aoVoltar,
  acoes,
  children,
}: {
  titulo: string;
  aoVoltar?: () => void;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-black/10 bg-herval-branco p-7 shadow-card">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2.5 text-sm font-extrabold uppercase tracking-wide text-herval-preto">
          <span className="h-4 w-1 rounded-full bg-herval-verde" />
          {titulo}
        </h2>
        <div className="flex items-center gap-3">
          {acoes}
          {aoVoltar && (
            <button
              type="button"
              onClick={aoVoltar}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Aviso({ estado }: { estado: ResultadoDoCadastro }) {
  if (estado.mensagem === "") return null;

  return (
    <span
      role="status"
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold",
        estado.ok
          ? "bg-herval-verde/15 text-herval-preto"
          : "border border-herval-vermelho/40 text-herval-preto",
      ].join(" ")}
    >
      {estado.ok ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5" />
      )}
      {estado.mensagem}
    </span>
  );
}

/**
 * Avisa o passo seguinte quando a gravação dá certo.
 *
 * Compara o número do envio, e não o `ok`: sem isso, um segundo cadastro
 * bem-sucedido não avisaria nada, porque o estado já estaria em `ok` desde o
 * primeiro e o efeito não voltaria a rodar.
 */
export function useQuandoDerCerto(
  estado: ResultadoDoCadastro,
  aoConcluir: (estado: ResultadoDoCadastro) => void,
) {
  const ultimoEnvio = useRef(0);
  /** O aviso muda de identidade a cada desenho; a referência não. */
  const guardado = useRef(aoConcluir);
  guardado.current = aoConcluir;

  useEffect(() => {
    if (estado.ok && estado.envio !== ultimoEnvio.current) {
      ultimoEnvio.current = estado.envio;
      guardado.current(estado);
    }
  }, [estado]);
}
