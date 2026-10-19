import * as v from 'valibot'
import type { ArquivoBackup, Calculadora, Categoria, Prescricao } from '@/dominio/tipos'

/**
 * Esquemas de validação (valibot) do arquivo de backup.
 * Os tipos `GenericSchema<unknown, T>` garantem que o esquema bate com o modelo TS.
 */

const id = v.pipe(v.string(), v.nonEmpty())
const data = v.pipe(v.string(), v.isoTimestamp())
const dataOuNulo = v.nullable(data)
const numero = v.pipe(v.number(), v.finite())
const numeroOuNulo = v.nullable(numero)
const gravidade = v.picklist(['informativo', 'atencao', 'critico'])

const entidade = {
  id,
  criadoEm: data,
  atualizadoEm: data,
  excluidoEm: dataOuNulo,
}

export const esquemaCategoria: v.GenericSchema<unknown, Categoria> = v.object({
  ...entidade,
  nome: v.string(),
  escopo: v.picklist(['prescricao', 'calculadora']),
  ordem: numero,
  // Opcional: backups feitos antes dos ícones de categoria não têm o campo.
  icone: v.optional(v.nullable(v.string()), null),
})

export const esquemaPrescricao: v.GenericSchema<unknown, Prescricao> = v.object({
  ...entidade,
  titulo: v.string(),
  categoriaId: v.nullable(id),
  tags: v.array(v.string()),
  itens: v.array(
    v.object({
      id,
      condicaoId: v.optional(v.nullable(id), null),
      opcoes: v.pipe(v.array(v.object({ id, texto: v.string(), motivo: v.string() })), v.minLength(1)),
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
  calculadoraIds: v.array(id),
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

export const esquemaCalculadora: v.GenericSchema<unknown, Calculadora> = v.variant('tipo', [
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

export const FORMATO_BACKUP = 'plantao-facil-backup'
export const VERSAO_FORMATO_ATUAL = 2

export const esquemaArquivoBackup: v.GenericSchema<unknown, ArquivoBackup> = v.object({
  formato: v.literal(FORMATO_BACKUP),
  versaoFormato: v.literal(VERSAO_FORMATO_ATUAL),
  exportadoEm: data,
  versaoApp: v.string(),
  prescricoes: v.array(esquemaPrescricao),
  calculadoras: v.array(esquemaCalculadora),
  categorias: v.array(esquemaCategoria),
})
