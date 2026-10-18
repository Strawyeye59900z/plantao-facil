import { describe, expect, it } from 'vitest'
import { aplicarDestaque, COR_DESTAQUE_PADRAO, CORES_DESTAQUE } from './destaque'

describe('cor de destaque', () => {
  it('o padrão é verde e as cores seguem a direção visual aprovada', () => {
    expect(COR_DESTAQUE_PADRAO).toBe('verde')
    expect(CORES_DESTAQUE.verde.hex).toBe('#0f9d8a')
    expect(CORES_DESTAQUE.azul.hex).toBe('#2f5bea')
    expect(CORES_DESTAQUE.coral.hex).toBe('#ef5b5b')
    expect(CORES_DESTAQUE.violeta.hex).toBe('#6d4fe0')
  })

  it('aplicarDestaque define o atributo no <html> e guarda a cópia local', () => {
    aplicarDestaque('coral')
    expect(document.documentElement.dataset.destaque).toBe('coral')
    expect(localStorage.getItem('plantao-facil:destaque')).toBe('coral')
  })
})
