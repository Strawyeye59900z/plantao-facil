import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { Prescricao } from '@/dominio/tipos'
import {
  definirCondicaoDoItem,
  duplicarPrescricao,
  moverCondicao,
  moverItem,
  moverItemNoGrupo,
  podeMoverItemNoGrupo,
  removerOpcao,
  normalizarTags,
  itemVazio,
  opcaoVazia,
  prescricaoVazia,
  removerItem,
  semCalculadorasInexistentes,
  validarPrescricao,
  type DadosPrescricao,
} from './editar'
import { prescricaoTeste } from './fixtures.spec-helper'

function geradorIds() {
  let n = 0
  return () => `novo-${++n}`
}

describe('duplicarPrescricao', () => {
  const original = prescricaoTeste({
    titulo: 'Situação Teste A',
    favorito: true,
    origem: 'importada_ia',
    revisada: false,
    itens: [
      {
        id: 'i-1',
        condicaoId: null,
        opcoes: [
          { id: 'o-1', texto: 'Medicamento Teste A', motivo: '' },
          { id: 'o-2', texto: 'Medicamento Teste B', motivo: 'Motivo Teste' },
        ],
      },
    ],
    alertas: [
      { id: 'al-1', tipo: 'outro', gravidade: 'informativo', texto: 'Alerta Teste', itemId: 'i-1' },
      { id: 'al-2', tipo: 'outro', gravidade: 'critico', texto: 'Alerta Geral Teste', itemId: null },
    ],
  })

  it('gera IDs novos (também nas opções) e mantém o vínculo alerta→item', () => {
    const copia = duplicarPrescricao(original, geradorIds())
    expect(copia.itens[0]!.id).toBe('novo-1')
    expect(copia.itens[0]!.opcoes).toEqual([
      { id: 'novo-2', texto: 'Medicamento Teste A', motivo: '' },
      { id: 'novo-3', texto: 'Medicamento Teste B', motivo: 'Motivo Teste' },
    ])
    expect(copia.alertas.map((a) => a.id)).toEqual(['novo-4', 'novo-5'])
    expect(copia.alertas[0]!.itemId).toBe('novo-1')
    expect(copia.alertas[1]!.itemId).toBeNull()
  })

  it('acrescenta "(cópia)", tira o favorito e mantém o status de revisão', () => {
    const copia = duplicarPrescricao(original, geradorIds())
    expect(copia.titulo).toBe('Situação Teste A (cópia)')
    expect(copia.favorito).toBe(false)
    expect(copia.revisada).toBe(false)
    expect(copia.origem).toBe('importada_ia')
    expect(copia).not.toHaveProperty('id')
  })

  it('aceita objetos reativos do Vue (store)', () => {
    const copia = duplicarPrescricao(reactive(structuredClone(original)) as Prescricao, geradorIds())
    expect(copia.titulo).toBe('Situação Teste A (cópia)')
  })

  it('não altera o original', () => {
    duplicarPrescricao(original, geradorIds())
    expect(original.itens[0]!.id).toBe('i-1')
    expect(original.itens[0]!.opcoes[0]!.id).toBe('o-1')
    expect(original.titulo).toBe('Situação Teste A')
  })
})

describe('itens vazios', () => {
  it('item novo vem com uma opção vazia', () => {
    expect(itemVazio(geradorIds(), 'c-a')).toEqual({ id: 'novo-1', condicaoId: 'c-a', opcoes: [{ id: 'novo-2', texto: '', motivo: '' }] })
    expect(opcaoVazia(geradorIds())).toEqual({ id: 'novo-1', texto: '', motivo: '' })
  })

  it('prescrição nova sem calculadoras ligadas', () => {
    expect(prescricaoVazia().calculadoraIds).toEqual([])
  })
})

describe('moverItem', () => {
  it('troca com o vizinho e ignora movimentos para fora da lista', () => {
    expect(moverItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moverItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(moverItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moverItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

describe('removerItem', () => {
  it('remove o item e passa os alertas ligados a ele para a prescrição inteira', () => {
    const dados = prescricaoVazia(geradorIds())
    const itemId = dados.itens[0]!.id
    dados.alertas = [{ id: 'al', tipo: 'outro', gravidade: 'atencao', texto: 'Alerta Teste', itemId }]
    const resultado = removerItem(dados, itemId)
    expect(resultado.itens).toHaveLength(0)
    expect(resultado.alertas[0]!.itemId).toBeNull()
  })
})

// Itens "Sempre" (s1, s2), condição A (a1, a2) e condição B (b1).
function dadosComCondicoes(): DadosPrescricao {
  const item = (id: string, condicaoId: string | null) => ({
    id,
    condicaoId,
    opcoes: [{ id: `${id}-o`, texto: `Medicamento Teste ${id}`, motivo: '' }],
  })
  return {
    ...prescricaoVazia(geradorIds()),
    condicoes: [
      { id: 'c-a', nome: 'Condição Teste A' },
      { id: 'c-b', nome: 'Condição Teste B' },
    ],
    itens: [item('s1', null), item('s2', null), item('a1', 'c-a'), item('a2', 'c-a'), item('b1', 'c-b')],
  }
}
const ids = (d: DadosPrescricao) => d.itens.map((i) => i.id)

describe('definirCondicaoDoItem', () => {
  it('troca a condição e leva o item para o fim do grupo novo', () => {
    const d = definirCondicaoDoItem(dadosComCondicoes(), 's1', 'c-a')
    expect(ids(d)).toEqual(['s2', 's1', 'a1', 'a2', 'b1'])
    expect(d.itens.find((i) => i.id === 's1')!.condicaoId).toBe('c-a')
  })

  it('voltar para "Sempre" leva o item para o grupo "Sempre"', () => {
    expect(ids(definirCondicaoDoItem(dadosComCondicoes(), 'b1', null))).toEqual(['s1', 's2', 'b1', 'a1', 'a2'])
  })

  it('não altera os dados recebidos', () => {
    const original = dadosComCondicoes()
    definirCondicaoDoItem(original, 's1', 'c-b')
    expect(ids(original)).toEqual(['s1', 's2', 'a1', 'a2', 'b1'])
    expect(original.itens[0]!.condicaoId).toBeNull()
  })
})

describe('moverCondicao', () => {
  it('troca a ordem das condições e os itens acompanham os grupos', () => {
    const d = moverCondicao(dadosComCondicoes(), 1, -1)
    expect(d.condicoes.map((c) => c.id)).toEqual(['c-b', 'c-a'])
    expect(ids(d)).toEqual(['s1', 's2', 'b1', 'a1', 'a2'])
  })

  it('ignora movimentos para fora da lista', () => {
    expect(ids(moverCondicao(dadosComCondicoes(), 0, -1))).toEqual(['s1', 's2', 'a1', 'a2', 'b1'])
  })
})

describe('moverItemNoGrupo', () => {
  it('move dentro do grupo da condição', () => {
    expect(ids(moverItemNoGrupo(dadosComCondicoes(), 3, -1))).toEqual(['s1', 's2', 'a2', 'a1', 'b1'])
    expect(ids(moverItemNoGrupo(dadosComCondicoes(), 0, 1))).toEqual(['s2', 's1', 'a1', 'a2', 'b1'])
  })

  it('não passa para outro grupo nem para fora da lista', () => {
    const d = dadosComCondicoes()
    expect(podeMoverItemNoGrupo(d, 1, 1)).toBe(false) // s2 → grupo A
    expect(podeMoverItemNoGrupo(d, 2, -1)).toBe(false) // a1 → "Sempre"
    expect(podeMoverItemNoGrupo(d, 0, -1)).toBe(false)
    expect(podeMoverItemNoGrupo(d, 4, 1)).toBe(false)
    expect(moverItemNoGrupo(d, 1, 1)).toBe(d)
  })
})

describe('removerOpcao', () => {
  const item = {
    id: 'i',
    condicaoId: null,
    opcoes: [
      { id: 'o-1', texto: 'Medicamento Teste A', motivo: '' },
      { id: 'o-2', texto: 'Medicamento Teste B', motivo: 'Motivo Teste' },
    ],
  }

  it('remove qualquer opção de um item "OU"; com 1 opção o item volta a ser simples', () => {
    expect(removerOpcao(item, 'o-1').opcoes).toEqual([{ id: 'o-2', texto: 'Medicamento Teste B', motivo: 'Motivo Teste' }])
    expect(removerOpcao(item, 'o-2').opcoes.map((o) => o.id)).toEqual(['o-1'])
  })

  it('não remove a única opção', () => {
    const simples = { ...item, opcoes: [item.opcoes[0]!] }
    expect(removerOpcao(simples, 'o-1')).toBe(simples)
  })
})

describe('normalizarTags', () => {
  it('separa por vírgula, tira espaços, vazias e repetidas', () => {
    expect(normalizarTags(['  tag a, Tag A ,', 'tag b', ''])).toEqual(['tag a', 'tag b'])
  })
})

describe('validarPrescricao', () => {
  const existe = (id: string) => id === 'c-1'

  it('prescrição vazia: exige título, categoria e texto do item', () => {
    expect(validarPrescricao(prescricaoVazia(), existe)).toEqual([
      'Informe o título.',
      'Escolha o grupo.',
      'Item 1: texto vazio.',
    ])
  })

  it('ignora ids de calculadoras que não existem mais (não bloqueia)', () => {
    const dados = { ...prescricaoTeste(), calculadoraIds: ['calc-que-sumiu'] }
    expect(validarPrescricao(dados, existe)).toEqual([])
    expect(semCalculadorasInexistentes(dados, (id) => id === 'ok').calculadoraIds).toEqual([])
    const mista = { ...dados, calculadoraIds: ['ok', 'calc-que-sumiu'] }
    expect(semCalculadorasInexistentes(mista, (id) => id === 'ok').calculadoraIds).toEqual(['ok'])
  })

  it('exige pelo menos 1 item', () => {
    const dados = { ...prescricaoVazia(), titulo: 'T', categoriaId: 'c-1', itens: [] }
    expect(validarPrescricao(dados, existe)).toEqual(['Inclua pelo menos 1 item.'])
  })

  it('rejeita categoria excluída/inexistente', () => {
    const dados = { ...prescricaoTeste(), categoriaId: 'c-9' }
    expect(validarPrescricao(dados, existe)).toEqual(['Escolha o grupo.'])
  })

  it('exige texto em todas as opções (motivo é opcional) e texto nos alertas', () => {
    const dados = prescricaoTeste({
      itens: [
        {
          id: 'i-1',
          condicaoId: null,
          opcoes: [
            { id: 'o-1', texto: 'Medicamento Teste A', motivo: '' },
            { id: 'o-2', texto: ' ', motivo: 'Motivo Teste' },
          ],
        },
        { id: 'i-2', condicaoId: null, opcoes: [{ id: 'o-3', texto: '', motivo: '' }] },
      ],
      alertas: [{ id: 'al', tipo: 'outro', gravidade: 'atencao', texto: '', itemId: null }],
    })
    expect(validarPrescricao(dados, existe)).toEqual([
      'Item 1, opção 2: texto vazio.',
      'Item 2: texto vazio.',
      'Alerta 1: texto vazio.',
    ])
  })

  it('item "OU" com opções preenchidas e sem motivo é válido', () => {
    const dados = prescricaoTeste({
      itens: [
        {
          id: 'i-1',
          condicaoId: null,
          opcoes: [
            { id: 'o-1', texto: 'Opção Teste 1', motivo: '' },
            { id: 'o-2', texto: 'Opção Teste 2', motivo: '' },
          ],
        },
      ],
    })
    expect(validarPrescricao(dados, existe)).toEqual([])
  })

  it('prescrição completa é válida', () => {
    expect(validarPrescricao(prescricaoTeste(), existe)).toEqual([])
  })
})
