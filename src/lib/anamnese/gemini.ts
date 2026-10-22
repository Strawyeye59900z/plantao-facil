/** Abre o Gemini numa aba nova (sem `opener`). Nenhum dado clínico vai no endereço. */
export function abrirGemini(): void {
  window.open('https://gemini.google.com/app', '_blank', 'noopener')
}
