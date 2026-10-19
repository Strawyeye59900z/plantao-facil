import * as v from 'valibot'
import type { ArquivoBackupV1, CalculadoraV1, CategoriaV1, PrescricaoV1, RegraDoseV1 } from './tipos'

/**
 * Esquemas de validação (valibot) do arquivo de backup da v1 (`versaoFormato: 1`). Cópia congelada:
 * NÃO alterar. Os tipos `GenericSchema<unknown, T>` garantem que o esquema bate com o modelo da v1.
 */

const id = v.pipe(v.string(), v.nonEmpty())
const data = v.pipe(v.string(), v.isoTimestamp())
const dataOuNulo = v.nullable(data)
const numero = v.pipe(v.number(), v.finite())
const numeroOuNulo = v.nullable(numero)
const gravidade = v.picklist(['informativo', 'atencao', 'critico'])
const direcao = v.picklist(['baixo', 'proximo', 'cima'])

const entidade = {
  id,
  criadoEm: data,
  atualizadoEm: data,
  excluidoEm: dataOuNulo,
}

export const esquemaCategoriaV1: v.GenericSchema<unknown, CategoriaV1> = v.object({
  ...entidade,
  nome: v.string(),
  escopo: v.picklist(['prescricao', 'calculadora']),
  ordem: numero,
  // Opcional: backups feitos antes dos ícones de categoria não têm o campo.
  icone: v.optional(v.nullable(v.string()), null),
})

const esquemaRegraDoseV1: v.GenericSchema<unknown, RegraDoseV1> = v.object({
  dosePorKg: numero,
  unidade: v.string(),
  baseDoseKg: v.picklist(['por_tomada', 'por_dia']),
  tomadasPorDia: numeroOuNulo,
  doseMaximaPorTomada: numeroOuNulo,
  doseMaximaDiaria: numeroOuNulo,
  pesoLimite: v.nullable(v.object({ acimaDeKg: numero, doseFixa: numero })),
  concentracao: v.nullable(v.object({ quantidade: numero, volumeMl: numero })),
  arredondamentoDose: v.variant('modo', [
    v.object({ modo: v.literal('inteiro') }),
    v.object({ modo: v.literal('multiplo'), passo: numero, direcao }),
  ]),
  arredondamentoVolume: v.variant('modo', [
    v.object({ modo: v.literal('casas_decimais'), casas: numero }),
    v.object({ modo: v.literal('multiplo'), passo: numero, direcao }),
  ]),
})

export const esquemaPrescricaoV1: v.GenericSchema<unknown, PrescricaoV1> = v.object({
  ...entidade,
  titulo: v.string(),
  categoriaId: v.nullable(id),
  tags: v.array(v.string()),
  itens: v.array(
    v.object({
      id,
      texto: v.string(),
      regraDose: v.nullable(esquemaRegraDoseV1),
      alternativas: v.array(
        v.object({ id, motivo: v.string(), texto: v.string(), regraDose: v.nullable(esquemaRegraDoseV1) }),
      ),
      opcoesEquivalentes: v.optional(v.boolean()),
      condicaoId: v.optional(v.nullable(id)),
    }),
  ),
  condicoes: v.optional(v.array(v.object({ id, nome: v.string() })), []),
  alertas: v.array(
    v.object({
      id,
      tipo: v.picklist(['contraindicacao', 'ajuste_renal', 'gestacao', 'interacao', 'atencao', 'outro']),
      gravidade,
      texto: v.string(),
      itemId: v.nullable(id),
    }),
  ),
  receita: v.optional(v.string(), ''),
  observacoes: v.string(),
  referencia: v.string(),
  favorito: v.boolean(),
  origem: v.picklist(['manual', 'importada_ia']),
  revisada: v.boolean(),
  duvidasImportacao: v.array(v.string()),
})

const faixa = { id, de: numeroOuNulo, ate: numeroOuNulo }
const calculadoraBase = {
  ...entidade,
  nome: v.string(),
  categoriaId: v.nullable(id),
  descricao: v.string(),
  referencia: v.string(),
  faixas: v.array(v.object({ ...faixa, texto: v.string(), gravidade })),
  favorito: v.boolean(),
}

export const esquemaCalculadoraV1: v.GenericSchema<unknown, CalculadoraV1> = v.variant('tipo', [
  v.object({
    ...calculadoraBase,
    tipo: v.literal('pontos'),
    campos: v.array(
      v.variant('tipo', [
        v.object({ id, tipo: v.literal('sim_nao'), rotulo: v.string(), pontosSim: numero, pontosNao: numero }),
        v.object({
          id,
          tipo: v.literal('selecao'),
          rotulo: v.string(),
          opcoes: v.array(v.object({ id, rotulo: v.string(), pontos: numero })),
        }),
        v.object({
          id,
          tipo: v.literal('numero'),
          rotulo: v.string(),
          unidade: v.string(),
          min: numeroOuNulo,
          max: numeroOuNulo,
          faixas: v.array(v.object({ ...faixa, pontos: numero })),
        }),
      ]),
    ),
  }),
  v.object({
    ...calculadoraBase,
    tipo: v.literal('formula'),
    entradas: v.array(
      v.object({ id, variavel: v.string(), rotulo: v.string(), unidade: v.string(), min: numero, max: numero }),
    ),
    expressao: v.string(),
    unidadeResultado: v.string(),
    casasDecimais: numero,
    teto: numeroOuNulo,
    piso: numeroOuNulo,
  }),
])

export const esquemaArquivoBackupV1: v.GenericSchema<unknown, ArquivoBackupV1> = v.object({
  formato: v.literal('plantao-facil-backup'),
  versaoFormato: v.literal(1),
  exportadoEm: data,
  versaoApp: v.string(),
  prescricoes: v.array(esquemaPrescricaoV1),
  calculadoras: v.array(esquemaCalculadoraV1),
  categorias: v.array(esquemaCategoriaV1),
})
