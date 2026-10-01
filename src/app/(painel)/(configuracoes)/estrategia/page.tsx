import Cabecalho from "@/components/Cabecalho";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import FormularioEstrategia from "@/components/FormularioEstrategia";
import { carregarEstrategiaDoCliente } from "@/lib/dados/estrategiaDoCliente";

/**
 * A Estratégia do Cliente.
 *
 * Três telas dizem coisas diferentes sobre o mesmo cliente: Clientes diz quem
 * ele é, Procedimentos diz o que ele oferece, e esta diz como aquela operação
 * comercial funciona — o que a Helô persegue na conversa, o que pode falar e o
 * que não pode.
 *
 * Deixou de se chamar "Estratégia da Clínica" porque em Clientes se cadastra
 * tanto clínica com equipe quanto profissional sozinho, e "clínica" excluía
 * metade de quem é atendido aqui.
 *
 * O cliente escolhido vem da URL (`?cliente=19`), e não de estado dentro da
 * tela, por uma razão prática: assim o link de uma ficha pode ser mandado para
 * outra pessoa e abrir na mesma ficha. É também o que permite a leitura
 * acontecer no servidor, antes de a tela ser desenhada.
 *
 * Sem `export const dynamic`, pelo mesmo motivo de Clientes e Procedimentos: a
 * leitura passa pelo cliente do Supabase, que lê os cookies da sessão, e isso já
 * torna a página dinâmica.
 */
export default async function PaginaEstrategia({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const parametros = await searchParams;

  /*
    `?cliente=` é texto vindo de fora e pode ser qualquer coisa — vazio, "abc",
    duas vezes o mesmo parâmetro (que chega como lista). Nada disso é erro: o que
    não é um número inteiro vira nulo, e quem lê abre o primeiro cliente da
    lista. URL torta não derruba tela.
  */
  const bruto = Array.isArray(parametros.cliente)
    ? parametros.cliente[0]
    : parametros.cliente;
  const numero = Number(bruto);
  const clienteId =
    bruto !== undefined && bruto !== "" && Number.isInteger(numero)
      ? numero
      : null;

  const { clientes, ficha, nomesDeProcedimentos, falha, aviso } =
    await carregarEstrategiaDoCliente(clienteId);

  return (
    <>
      <Cabecalho
        titulo="Estratégia do Cliente"
        descricao="Como a operação comercial de cada cliente funciona: o que a Helô persegue na conversa, o que pode falar e o que não pode."
      />
      <AvisoDeCorte aviso={aviso} />
      <FormularioEstrategia
        clientes={clientes}
        ficha={ficha}
        // Vira objeto simples porque a tela só faz consulta por id, e objeto é o
        // que o resto dos componentes já recebe. A busca é a mesma.
        nomesDeProcedimentos={Object.fromEntries(nomesDeProcedimentos)}
        falha={falha}
      />
    </>
  );
}
