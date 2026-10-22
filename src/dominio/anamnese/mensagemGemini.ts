/** Mensagem enviada ao @nova-consulta no Gemini: a skill do usuário recebe a transcrição e o formato pedido. */
export const INSTRUCAO_SOAP =
  'Organize no modelo SOAP (Subjetivo, Objetivo, Avaliação, Plano), usando só o que foi dito na transcrição. O que não foi dito fica como "Não informado".'

export function montarMensagemGemini(transcricao: string): string {
  return `@nova-consulta\n${INSTRUCAO_SOAP}\n\n${transcricao}`
}
