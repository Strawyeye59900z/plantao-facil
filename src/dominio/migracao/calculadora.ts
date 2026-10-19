import type { Calculadora, Categoria, UUID } from '@/dominio/tipos'
import type { CalculadoraV1, CategoriaV1 } from './v1/tipos'

/**
 * Conversão mínima de uma calculadora da v1 para o modelo atual (função pura).
 * Pontos: ganha `area: 'escala'`. Fórmula: `entradas` viram campos numéricos e a expressão
 * única vira a saída "Resultado" (com as faixas de interpretação e o teto/piso).
 * Ids gerados são determinísticos (`<id>-saida`): a mesma calculadora migrada no banco e
 * no backup fica igual. Registros crus sem listas (`faixas`, `campos`, `entradas`) ganham [].
 * Registro que já tem `area` já está no modelo atual e passa sem mudança.
 */
export function migrarCalculadoraV1(c: CalculadoraV1): Calculadora {
  if ('area' in c) return c as unknown as Calculadora
  if (c.tipo === 'pontos') return { ...c, area: 'escala', faixas: c.faixas ?? [], campos: c.campos ?? [] }
  const { entradas, expressao, unidadeResultado, casasDecimais, teto, piso, faixas, ...resto } = c
  return {
    ...resto,
    area: 'calculadora',
    tipo: 'formula',
    campos: (entradas ?? []).map((e) => ({ id: e.id, tipo: 'numero', variavel: e.variavel, rotulo: e.rotulo, unidade: e.unidade, min: e.min, max: e.max })),
    saidas: [{ id: `${c.id}-saida`, nome: 'Resultado', expressao, unidade: unidadeResultado, casasDecimais, teto, piso, faixas: (faixas ?? []).map((f) => ({ ...f })) }],
  }
}

/** Id da cópia `escala` de um grupo usado por calculadoras e escalas (determinístico). */
export function idCopiaEscala(categoriaId: UUID): UUID {
  return `${categoriaId}-escala`
}

/**
 * Separa os grupos de calculadoras da v1 entre calculadoras e escalas (função pura).
 * Para cada grupo `calculadora` fora da lixeira, olha as calculadoras que o usam (inclusive as da lixeira):
 * - só escalas (pontos) → o grupo vira `escopo: 'escala'`;
 * - escalas e calculadoras → o grupo fica e ganha uma cópia `escala` (mesmo nome, ícone, ordem e datas;
 *   id `<id>-escala`), e as escalas passam para a cópia (`remapear`: id da calculadora → novo grupo);
 * - sem uso (ou só calculadoras) → fica igual.
 * Grupos de prescrição e grupos na lixeira ficam como estão. As cópias vão no fim da lista.
 */
export function migrarGruposV1(
  categorias: CategoriaV1[],
  calculadorasV1: CalculadoraV1[],
): { categorias: Categoria[]; remapear: Map<UUID, UUID | null> } {
  const areas = calculadorasV1.map((c) => ({ id: c.id, categoriaId: c.categoriaId, area: migrarCalculadoraV1(c).area }))
  const remapear = new Map<UUID, UUID | null>()
  const copias: Categoria[] = []
  const convertidas = categorias.map((g): Categoria => {
    if (g.escopo !== 'calculadora' || g.excluidoEm !== null) return g
    const usuarias = areas.filter((c) => c.categoriaId === g.id)
    const escalas = usuarias.filter((c) => c.area === 'escala')
    if (escalas.length === 0) return g
    if (escalas.length === usuarias.length) return { ...g, escopo: 'escala' }
    const copia: Categoria = { ...g, id: idCopiaEscala(g.id), escopo: 'escala', icone: g.icone ?? null }
    copias.push(copia)
    for (const c of escalas) remapear.set(c.id, copia.id)
    return g
  })
  return { categorias: [...convertidas, ...copias], remapear }
}

/** Converte calculadoras e grupos da v1 juntos, já com as escalas apontando para o grupo certo. */
export function migrarCalculadorasEGruposV1(
  calculadorasV1: CalculadoraV1[],
  categoriasV1: CategoriaV1[],
): { calculadoras: Calculadora[]; categorias: Categoria[] } {
  const { categorias, remapear } = migrarGruposV1(categoriasV1, calculadorasV1)
  const calculadoras = calculadorasV1.map((c) => {
    const nova = migrarCalculadoraV1(c)
    return remapear.has(c.id) ? { ...nova, categoriaId: remapear.get(c.id)! } : nova
  })
  return { calculadoras, categorias }
}
