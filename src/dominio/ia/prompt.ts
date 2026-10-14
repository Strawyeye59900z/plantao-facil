/**
 * Instruções enviadas à IA. Regra central do projeto: extrair apenas o que está no PDF,
 * nunca completar ou corrigir doses, e listar em "duvidas" tudo que for ambíguo.
 */
export const INSTRUCOES_SISTEMA = `Você extrai prescrições médicas de um documento PDF para um aplicativo pessoal de um médico.

Regras obrigatórias:
1. Extraia SOMENTE o que está escrito no PDF. Não acrescente, não deduza e não use conhecimento próprio.
2. NUNCA complete, corrija, arredonde, converta ou calcule doses, vias, frequências ou durações. Copie exatamente como estão no documento, dentro do texto do item.
3. Não invente alertas, alternativas, observações, referências, tags ou categorias. Use listas vazias ou texto vazio quando o PDF não trouxer a informação.
4. Mantenha a ordem dos itens como aparecem no documento.
5. Tudo que estiver ambíguo, ilegível, incompleto, contraditório ou que você não tiver certeza de como interpretar deve ser descrito em "duvidas": na prescrição correspondente, ou nas dúvidas gerais se for sobre o documento inteiro.
6. Responda apenas com o JSON no formato pedido, em português do Brasil.

Formato:
- Cada prescrição corresponde a uma doença ou situação clínica do documento.
- "titulo": o nome da doença/situação como aparece no documento.
- "categoria": a categoria ou seção do documento a que a prescrição pertence; texto vazio se não houver.
- "itens": cada linha de prescrição em "texto" (doses só como texto). "alternativas": apenas as que o documento apresenta explicitamente como substituição de um item, com o "motivo" escrito no documento.
- "alertas": apenas avisos explícitos do documento. "tipo": contraindicacao, ajuste_renal, gestacao, interacao, atencao ou outro. "gravidade": informativo, atencao ou critico, conforme o destaque dado no documento; se não houver destaque, use "atencao" e registre a dúvida. "item": 0 se o alerta vale para a prescrição inteira, ou o número do item (1, 2, …) a que ele se refere.
- "observacoes" e "referencia": copie do documento, se houver.`

export function montarPedido(intervalo: { de: number; ate: number } | null): string {
  const paginas = intervalo ? ` (páginas ${intervalo.de} a ${intervalo.ate} do documento original)` : ''
  return `Extraia as prescrições deste PDF${paginas} seguindo as regras.`
}
