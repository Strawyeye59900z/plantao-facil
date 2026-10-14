// Dados fictícios para testes — nenhum conteúdo clínico real.
import type { Categoria, Prescricao } from '@/dominio/tipos'

export function prescricaoTeste(parcial: Partial<Prescricao> = {}): Prescricao {
  return {
    id: 'p-1',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    excluidoEm: null,
    titulo: 'Situação Teste A',
    categoriaId: 'c-1',
    tags: [],
    itens: [{ id: 'i-1', texto: 'Medicamento Teste A', regraDose: null, alternativas: [] }],
    alertas: [],
    observacoes: '',
    referencia: '',
    favorito: false,
    origem: 'manual',
    revisada: true,
    duvidasImportacao: [],
    ...parcial,
  }
}

export function categoriaTeste(parcial: Partial<Categoria> = {}): Categoria {
  return {
    id: 'c-1',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    excluidoEm: null,
    nome: 'Categoria Teste A',
    escopo: 'prescricao',
    ordem: 0,
    icone: null,
    ...parcial,
  }
}
