import type { Biblioteca } from '@/dominio/backup/backup'
import type { UUID } from '@/dominio/tipos'
import { migrarCalculadorasEGruposV1 } from './calculadora'
import { migrarPrescricaoV1 } from './prescricao'
import type { CalculadoraV1, CategoriaV1, PrescricaoV1 } from './v1/tipos'

/** Biblioteca no modelo da v1 (backup formato 1 / banco antes da v2), inclusive itens na lixeira. */
export interface BibliotecaV1 {
  prescricoes: PrescricaoV1[]
  calculadoras: CalculadoraV1[]
  categorias: CategoriaV1[]
}

/**
 * Converte uma biblioteca da v1 para o modelo atual. Prescrições: `migrarPrescricaoV1`;
 * calculadoras e grupos: `migrarCalculadorasEGruposV1` (escalas separadas das calculadoras, com ids
 * determinísticos — o mesmo conteúdo migrado no banco e no backup fica igual).
 * Função pura: não altera a biblioteca recebida.
 */
export function migrarBibliotecaV1(b: BibliotecaV1, gerarId?: () => UUID): Biblioteca {
  const { calculadoras, categorias } = migrarCalculadorasEGruposV1(b.calculadoras, b.categorias)
  return {
    prescricoes: b.prescricoes.map((p) => migrarPrescricaoV1(p, gerarId)),
    calculadoras,
    categorias,
  }
}
