import * as v from 'valibot'

/** Descreve em português os primeiros problemas de uma validação do valibot (caminho: o que era esperado). */
export function descreverProblemas(problemas: readonly v.BaseIssue<unknown>[], maximo = 3): string {
  return problemas
    .slice(0, maximo)
    .map((p) => `${v.getDotPath(p) ?? '(raiz)'}: esperado ${p.expected ?? 'outro valor'}, recebido ${p.received}`)
    .join('; ')
}
