/** Aba do Gemini aberta por este app. Só vale enquanto o app estiver aberto: recarregar a página esquece a aba. */
let aba: Window | null = null

/**
 * Leva o usuário ao Gemini sem abrir uma aba nova a cada consulta: se a aba que o app abriu ainda
 * existe, só a traz para a frente; senão abre uma. Nenhum dado clínico vai no endereço.
 */
export function abrirGemini(): void {
  if (aba && !aba.closed) {
    aba.focus()
    return
  }
  aba = window.open('https://gemini.google.com/app', 'gemini-plantao')
}
