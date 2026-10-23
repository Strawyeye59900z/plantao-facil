<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import {
  Check,
  Circle,
  CircleAlert,
  CircleCheck,
  ClipboardCopy,
  Download,
  FileUp,
  Loader2,
  MessagesSquare,
  Pencil,
  Scissors,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import FormularioPrescricao from '@/components/prescricoes/FormularioPrescricao.vue'
import { useAvisoSaida } from '@/composables/useAvisoSaida'
import { encontrarDuplicatas } from '@/dominio/ia/duplicatas'
import { descreverTrecho, dividirEmLotes, dividirTrecho, nomeArquivoLote, PAGINAS_POR_LOTE, type Trecho } from '@/dominio/ia/lotes'
import { PROVEDORES } from '@/dominio/ia/provedores'
import { criarRascunhos, type RascunhoImportado } from '@/dominio/ia/rascunhos'
import { validarPrescricao } from '@/dominio/prescricoes/editar'
import { enviarParaIA } from '@/lib/enviarParaIA'
import { copiarTexto } from '@/lib/areaTransferencia'
import { baixarArquivo } from '@/lib/arquivo'
import { montarPromptChat } from '@/dominio/ia/prompt'
import { lerRespostaIA, type RespostaIA } from '@/dominio/ia/resposta'
import { contarPaginas, recortarPaginas } from '@/lib/pdf'
import { ROTULO_SEM_CATEGORIA, useCategoriasStore } from '@/stores/categorias'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { usePrescricoesStore } from '@/stores/prescricoes'

const configuracoes = useConfiguracoesStore()
const categorias = useCategoriasStore()
const prescricoes = usePrescricoesStore()

const provedor = computed(() => PROVEDORES[configuracoes.config.ia.provedor])
const chave = computed(() => configuracoes.config.ia.chaves[provedor.value.id] ?? '')
const modelo = computed(() => configuracoes.modeloDe(provedor.value.id))

// ===== Arquivo e intervalo =====
const entrada = ref<HTMLInputElement | null>(null)
const arquivo = shallowRef<{ nome: string; bytes: Uint8Array; paginas: number } | null>(null)
const erroArquivo = ref<string | null>(null)
const usarIntervalo = ref(false)
const paginaDe = ref<number | null>(null)
const paginaAte = ref<number | null>(null)
const confirmado = ref(false)

const MB = 1024 * 1024
const tamanho = (bytes: number) =>
  bytes < MB
    ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('pt-BR')} KB`
    : `${(bytes / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`

async function aoEscolher(evento: Event) {
  const f = (evento.target as HTMLInputElement).files?.[0]
  if (entrada.value) entrada.value.value = ''
  if (!f) return
  erroArquivo.value = null
  arquivo.value = null
  try {
    const bytes = new Uint8Array(await f.arrayBuffer())
    arquivo.value = { nome: f.name, bytes, paginas: await contarPaginas(bytes) }
    paginaDe.value = 1
    paginaAte.value = arquivo.value.paginas
    usarIntervalo.value = false
  } catch (e) {
    erroArquivo.value = e instanceof Error ? e.message : String(e)
  }
}

const erroIntervalo = computed(() => {
  const a = arquivo.value
  if (!a || !usarIntervalo.value) return null
  const de = paginaDe.value
  const ate = paginaAte.value
  if (de === null || ate === null || !Number.isInteger(de) || !Number.isInteger(ate) || de < 1 || ate > a.paginas || de > ate) {
    return `Intervalo inválido: use páginas de 1 a ${a.paginas}, com "de" ≤ "até".`
  }
  return null
})

/** Lotes que serão usados (intervalo escolhido ou o PDF inteiro). */
const trechosPlanejados = computed<Trecho[]>(() => {
  const a = arquivo.value
  if (!a || erroIntervalo.value) return []
  return usarIntervalo.value ? dividirEmLotes(paginaDe.value!, paginaAte.value!) : dividirEmLotes(1, a.paginas)
})
const resumoLotes = computed(() => {
  const t = trechosPlanejados.value
  if (!t.length) return ''
  const total = { de: t[0]!.de, ate: t.at(-1)!.ate }
  return t.length === 1
    ? `1 lote (${descreverTrecho(total)}).`
    : `${t.length} lotes de até ${PAGINAS_POR_LOTE} páginas (${descreverTrecho(total)}); cada lote repete a última página do anterior.`
})

/** Motivo para não poder enviar pela API ainda (null = pode). */
const bloqueioApi = computed(() => {
  if (!arquivo.value) return 'Escolha um PDF.'
  if (!chave.value) return `Cadastre a chave de API do ${provedor.value.nome} em Ajustes.`
  if (erroIntervalo.value) return erroIntervalo.value
  if (!confirmado.value) return 'Confirme o envio na caixa acima.'
  return null
})

// ===== Sessão de importação (lotes) =====
type EstadoLote = 'pendente' | 'enviando' | 'concluido' | 'erro'
interface Lote {
  id: string
  rotulo: string
  trecho: Trecho
  estado: EstadoLote
  erro: string | null
  prescricoes: number
  duvidas: string[]
}

const modo = ref<'api' | 'chat' | null>(null)
const lotes = ref<Lote[]>([])
/** API: envio parado (cancelado ou sem internet); os lotes pendentes esperam "Continuar". */
const pausado = ref(false)
let controlador: AbortController | null = null
let processando = false

const rascunhos = ref<RascunhoImportado[]>([])
const editando = ref<string | null>(null)
const errosPorRascunho = ref<Record<string, string[]>>({})
const aprovadas = ref(0)

const novoLote = (rotulo: string, trecho: Trecho): Lote => ({
  id: crypto.randomUUID(),
  rotulo,
  trecho,
  estado: 'pendente',
  erro: null,
  prescricoes: 0,
  duvidas: [],
})

const enviando = computed(() => lotes.value.some((l) => l.estado === 'enviando'))
const concluidos = computed(() => lotes.value.filter((l) => l.estado === 'concluido').length)
const lotesTerminados = computed(() => lotes.value.length > 0 && concluidos.value === lotes.value.length)
const temPendentesApi = computed(() => modo.value === 'api' && lotes.value.some((l) => l.estado === 'pendente'))

function iniciar(m: 'api' | 'chat') {
  if (!trechosPlanejados.value.length) return
  if (m === 'api' && bloqueioApi.value) return
  modo.value = m
  lotes.value = trechosPlanejados.value.map((t, i) => novoLote(`Lote ${i + 1}`, t))
  rascunhos.value = []
  errosPorRascunho.value = {}
  aprovadas.value = 0
  pausado.value = false
  confirmado.value = false // a confirmação vale para este envio (todos os lotes)
  loteAberto.value = lotes.value[0]!.id
  if (m === 'api') void processarFila()
}

/** O PDF do lote é o documento inteiro? Então o prompt não fala em trecho. */
const ehDocumentoInteiro = (t: Trecho) => t.de === 1 && t.ate === arquivo.value?.paginas
const trechoDoPrompt = (t: Trecho) => (ehDocumentoInteiro(t) ? null : t)

async function pdfDoLote(t: Trecho): Promise<Uint8Array> {
  const a = arquivo.value!
  return ehDocumentoInteiro(t) ? a.bytes : recortarPaginas(a.bytes, t.de, t.ate)
}

/** Recebe a resposta de um lote: as prescrições entram na revisão (dá para revisar enquanto os outros chegam). */
function receber(lote: Lote, resposta: RespostaIA) {
  const novos = criarRascunhos(resposta, categorias.todas, undefined, { rotulo: lote.rotulo, trecho: lote.trecho })
  rascunhos.value.push(...novos)
  lote.estado = 'concluido'
  lote.erro = null
  lote.prescricoes = novos.length
  lote.duvidas = resposta.duvidas
}

/** Troca o lote por duas metades. false = lote de 1 página, não dá para dividir. */
function dividir(lote: Lote, motivo: string): boolean {
  const metades = dividirTrecho(lote.trecho)
  const i = lotes.value.findIndex((l) => l.id === lote.id)
  if (!metades || i === -1) return false
  const filhos = metades.map((t, k) => novoLote(`${lote.rotulo}.${k + 1}`, t))
  lotes.value.splice(i, 1, ...filhos)
  if (loteAberto.value === lote.id) loteAberto.value = filhos[0]!.id
  toast(`${lote.rotulo}: ${motivo} Dividido em 2 lotes menores.`)
  return true
}

function falhar(lote: Lote, erro: string) {
  lote.estado = 'erro'
  lote.erro = erro
}

// ----- API: um lote por vez -----
async function processarFila() {
  if (processando) return
  processando = true
  pausado.value = false
  try {
    for (;;) {
      const lote = lotes.value.find((l) => l.estado === 'pendente')
      if (!lote || pausado.value || modo.value !== 'api') break
      await enviarLote(lote)
    }
  } finally {
    processando = false
  }
}

async function enviarLote(lote: Lote) {
  if (!navigator.onLine) {
    pausado.value = true
    falhar(lote, 'Sem internet. A importação por IA é a única função do app que precisa de conexão.')
    return
  }
  lote.estado = 'enviando'
  lote.erro = null
  const sinal = (controlador = new AbortController()).signal
  try {
    const pdf = await pdfDoLote(lote.trecho)
    if (sinal.aborted) {
      lote.estado = 'pendente'
      return
    }
    if (pdf.length > provedor.value.limites.bytesPdf) {
      const motivo = `o trecho tem ${tamanho(pdf.length)}, acima do limite do ${provedor.value.nome} (${provedor.value.limites.descricao}).`
      if (!dividir(lote, `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}`)) falhar(lote, `Página grande demais: ${motivo}`)
      return
    }
    const r = await enviarParaIA(provedor.value, {
      pdf,
      trecho: trechoDoPrompt(lote.trecho),
      totalPaginas: arquivo.value!.paginas,
      modelo: modelo.value,
      chave: chave.value,
      sinal,
    })
    if (sinal.aborted) {
      lote.estado = 'pendente'
      return
    }
    if (r.ok) receber(lote, r.resposta)
    else if (!(r.cortada && dividir(lote, r.erro))) falhar(lote, r.erro)
  } catch (e) {
    falhar(lote, e instanceof Error ? e.message : String(e))
  } finally {
    controlador = null
  }
}

function cancelar() {
  pausado.value = true
  controlador?.abort()
}

function tentarDeNovo(lote: Lote) {
  lote.estado = 'pendente'
  lote.erro = null
  void processarFila()
}

// ----- Chat no navegador: um lote por vez, colando a resposta -----
const loteAberto = ref<string | null>(null)
const verPrompt = ref(false)
const respostas = ref<Record<string, string>>({})

async function baixarLote(lote: Lote) {
  try {
    baixarArquivo(nomeArquivoLote(arquivo.value!.nome, lote.trecho), await pdfDoLote(lote.trecho), 'application/pdf')
  } catch (e) {
    toast.error(`Não foi possível gerar o PDF do lote: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function copiarPrompt(lote: Lote) {
  try {
    await copiarTexto(montarPromptChat(trechoDoPrompt(lote.trecho), arquivo.value!.paginas))
    toast.success('Prompt copiado. Cole no chat junto com o PDF do lote.')
  } catch {
    toast.error('Não foi possível copiar. Use "Ver prompt" e copie manualmente.')
  }
}

function revisarColado(lote: Lote) {
  const r = lerRespostaIA(respostas.value[lote.id] ?? '')
  if (!r.ok) {
    falhar(lote, r.erro)
    return
  }
  receber(lote, r.resposta)
  delete respostas.value[lote.id]
  verPrompt.value = false
  loteAberto.value = lotes.value.find((l) => l.estado !== 'concluido')?.id ?? null
}

// ===== Revisão =====
const opcoesCategoria = computed(() => [
  { valor: null as string | null, rotulo: ROTULO_SEM_CATEGORIA },
  ...categorias.dePrescricoes.map((c) => ({ valor: c.id as string | null, rotulo: c.nome })),
])

const origemDe = (r: RascunhoImportado) => (r.lote ? `${r.lote.rotulo}, ${descreverTrecho(r.lote.trecho)}` : 'importada')

/** Mesmo título entre as importadas ou com uma já salva: só marca, o usuário decide. */
const duplicatas = computed(() =>
  encontrarDuplicatas(
    rascunhos.value.map((r) => ({ chave: r.chave, titulo: r.dados.titulo, origem: origemDe(r) })),
    prescricoes.ativas.map((p) => p.titulo),
  ),
)

const nomeCondicao = (r: RascunhoImportado, condicaoId: string | null | undefined) =>
  condicaoId ? (r.dados.condicoes.find((c) => c.id === condicaoId)?.nome ?? null) : null

const lotesComDuvidas = computed(() => lotes.value.filter((l) => l.duvidas.length))

function remover(chaveRascunho: string) {
  rascunhos.value = rascunhos.value.filter((r) => r.chave !== chaveRascunho)
  if (editando.value === chaveRascunho) editando.value = null
}

async function aprovar(r: RascunhoImportado) {
  const erros = validarPrescricao(r.dados, (id) => !!categorias.obter(id), { aceitarSemCategoria: true })
  if (erros.length) {
    errosPorRascunho.value = { ...errosPorRascunho.value, [r.chave]: erros }
    editando.value = r.chave
    return
  }
  try {
    await prescricoes.criar(r.dados)
    aprovadas.value++
    remover(r.chave)
    toast.success(`“${r.dados.titulo}” salva como importada — não revisada.`)
  } catch (e) {
    toast.error(`Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function descartar(r: RascunhoImportado) {
  remover(r.chave)
  toast(`“${r.dados.titulo || 'Sem título'}” descartada.`)
}

function recomecar() {
  pausado.value = true
  controlador?.abort()
  modo.value = null
  lotes.value = []
  rascunhos.value = []
  respostas.value = {}
  aprovadas.value = 0
  arquivo.value = null
}

// Sair (ou encerrar) com prescrições não aprovadas ou lotes faltando descarta o que não foi salvo.
const pendentes = computed(() => rascunhos.value.length > 0 || (modo.value !== null && !lotesTerminados.value))
const { confirmarSaida, responderSaida } = useAvisoSaida(pendentes)
const confirmarEncerrar = ref(false)

function encerrar() {
  if (pendentes.value) confirmarEncerrar.value = true
  else recomecar()
}

onBeforeUnmount(() => {
  pausado.value = true
  controlador?.abort()
})
</script>

<template>
  <section class="flex flex-col gap-4 pb-6">
    <h1 class="flex items-center gap-2 text-2xl font-semibold"><Sparkles class="size-6" /> Importar PDF</h1>

    <!-- ===== Importação em andamento: lotes + revisão ===== -->
    <template v-if="modo && arquivo">
      <Card>
        <CardHeader>
          <CardTitle class="break-all">{{ arquivo.nome }}</CardTitle>
          <CardDescription>
            {{ modo === 'api' ? `${provedor.nome} · modelo ${modelo}` : 'Chat no navegador' }} ·
            {{ concluidos }} de {{ lotes.length }} {{ lotes.length === 1 ? 'lote concluído' : 'lotes concluídos' }}
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <p v-if="modo === 'chat'" class="text-muted-foreground text-sm">
            Para cada lote: baixe o PDF do lote, anexe no chat (<strong>sem dados de pacientes</strong>) com o prompt e cole a
            resposta aqui.
          </p>

          <ul class="flex flex-col divide-y rounded-xl border">
            <li v-for="l in lotes" :key="l.id" class="flex flex-col gap-2 p-2.5">
              <div class="flex min-h-11 flex-wrap items-center gap-2">
                <Loader2 v-if="l.estado === 'enviando'" class="text-primary size-5 shrink-0 animate-spin" />
                <CircleCheck v-else-if="l.estado === 'concluido'" class="text-primary size-5 shrink-0" />
                <CircleAlert v-else-if="l.estado === 'erro'" class="text-critico size-5 shrink-0" />
                <Circle v-else class="text-muted-foreground size-5 shrink-0" />
                <button
                  v-if="modo === 'chat' && l.estado !== 'concluido'"
                  type="button"
                  class="min-h-11 flex-1 text-left text-sm font-medium"
                  :aria-expanded="loteAberto === l.id"
                  @click="loteAberto = loteAberto === l.id ? null : l.id"
                >
                  {{ l.rotulo }} · {{ descreverTrecho(l.trecho) }}
                </button>
                <span v-else class="flex-1 text-sm font-medium">{{ l.rotulo }} · {{ descreverTrecho(l.trecho) }}</span>
                <span v-if="l.estado === 'concluido'" class="text-muted-foreground text-sm">
                  {{ l.prescricoes === 0 ? 'nenhuma prescrição' : l.prescricoes === 1 ? '1 prescrição' : `${l.prescricoes} prescrições` }}
                </span>
                <span v-else-if="l.estado === 'enviando'" class="text-muted-foreground text-sm">enviando…</span>
                <Button v-if="modo === 'api' && l.estado === 'erro'" size="touch" variant="outline" :disabled="!chave" @click="tentarDeNovo(l)">
                  Tentar de novo
                </Button>
              </div>
              <p v-if="l.erro" role="alert" class="text-critico text-sm">{{ l.erro }}</p>

              <!-- Chat: ações do lote aberto -->
              <div v-if="modo === 'chat' && loteAberto === l.id && l.estado !== 'concluido'" class="flex flex-col gap-3 pb-1">
                <div class="flex flex-wrap gap-2">
                  <Button size="touch" variant="outline" @click="baixarLote(l)"><Download /> Baixar PDF do lote</Button>
                  <Button size="touch" @click="copiarPrompt(l)"><ClipboardCopy /> Copiar prompt</Button>
                  <Button size="touch" variant="outline" @click="verPrompt = !verPrompt">
                    {{ verPrompt ? 'Ocultar prompt' : 'Ver prompt' }}
                  </Button>
                </div>
                <pre
                  v-if="verPrompt"
                  class="bg-muted max-h-80 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap"
                >{{ montarPromptChat(trechoDoPrompt(l.trecho), arquivo.paginas) }}</pre>
                <div class="flex flex-col gap-1.5">
                  <Label :for="`resposta-${l.id}`">Resposta do chat para o {{ l.rotulo.toLowerCase() }}</Label>
                  <Textarea
                    :id="`resposta-${l.id}`"
                    v-model="respostas[l.id]"
                    class="min-h-32 font-mono text-xs"
                    placeholder="Cole aqui o JSON devolvido pelo chat"
                    spellcheck="false"
                  />
                </div>
                <div class="flex flex-wrap gap-2">
                  <Button size="touch" :disabled="!respostas[l.id]?.trim()" @click="revisarColado(l)"><Check /> Revisar prescrições</Button>
                  <Button
                    v-if="l.trecho.ate > l.trecho.de"
                    size="touch"
                    variant="outline"
                    @click="dividir(l, 'Dividido a pedido (resposta grande demais para o chat).')"
                  >
                    <Scissors /> Dividir em 2
                  </Button>
                </div>
              </div>
            </li>
          </ul>

          <template v-if="modo === 'api'">
            <div v-if="enviando" class="flex flex-wrap items-center gap-2">
              <Button size="touch" variant="outline" @click="cancelar">Cancelar envio</Button>
              <p class="text-muted-foreground text-xs">Cada lote pode levar alguns minutos. Já dá para revisar o que chegou.</p>
            </div>
            <div v-else-if="temPendentesApi" class="flex flex-wrap items-center gap-2">
              <Button size="touch" :disabled="!chave" @click="processarFila"><Sparkles /> Continuar envio</Button>
              <p class="text-muted-foreground text-sm">Envio pausado.</p>
            </div>
          </template>

          <Button size="touch" variant="ghost" class="self-start" @click="encerrar"><X /> Encerrar importação</Button>
        </CardContent>
      </Card>

      <div v-if="lotesComDuvidas.length" class="border-atencao/45 bg-atencao/12 rounded-xl border p-3">
        <p class="flex items-center gap-2 font-semibold"><TriangleAlert class="text-atencao size-4" /> Dúvidas da IA sobre o documento</p>
        <div v-for="l in lotesComDuvidas" :key="l.id" class="mt-2 text-sm">
          <p class="font-medium">{{ l.rotulo }} · {{ descreverTrecho(l.trecho) }}</p>
          <ul class="list-disc pl-5">
            <li v-for="(d, i) in l.duvidas" :key="i">{{ d }}</li>
          </ul>
        </div>
      </div>

      <p v-if="rascunhos.length || aprovadas" class="text-muted-foreground text-sm">
        {{ rascunhos.length }} {{ rascunhos.length === 1 ? 'prescrição para revisar' : 'prescrições para revisar' }}
        <template v-if="aprovadas"> · {{ aprovadas }} {{ aprovadas === 1 ? 'aprovada' : 'aprovadas' }}</template>.
        Nada é salvo sem sua aprovação.
      </p>

      <Card v-for="r in rascunhos" :key="r.chave">
        <CardHeader>
          <CardTitle>{{ r.dados.titulo || 'Sem título' }}</CardTitle>
          <CardDescription>
            <template v-if="r.lote">{{ r.lote.rotulo }} · {{ descreverTrecho(r.lote.trecho) }}</template>
            <template v-if="r.lote && r.categoriaSugerida"> · </template>
            <template v-if="r.categoriaSugerida">Categoria no documento: “{{ r.categoriaSugerida }}”</template>
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
          <div v-if="duplicatas[r.chave]" class="border-atencao/45 bg-atencao/12 rounded-xl border p-2.5 text-sm">
            <p class="flex items-center gap-1.5 font-semibold"><TriangleAlert class="text-atencao size-4" /> Possível duplicata de:</p>
            <ul class="list-disc pl-5">
              <li v-for="d in duplicatas[r.chave]" :key="d">{{ d }}</li>
            </ul>
          </div>

          <div v-if="r.dados.duvidasImportacao.length" class="border-atencao/45 bg-atencao/12 rounded-xl border p-2.5 text-sm">
            <p class="font-semibold">Dúvidas da IA</p>
            <ul class="list-disc pl-5">
              <li v-for="(d, i) in r.dados.duvidasImportacao" :key="i">{{ d }}</li>
            </ul>
          </div>

          <div v-if="errosPorRascunho[r.chave]?.length" role="alert" class="border-critico/35 bg-critico/10 rounded-xl border p-2.5 text-sm">
            <p class="font-semibold">Corrija antes de aprovar:</p>
            <ul class="list-disc pl-5">
              <li v-for="e in errosPorRascunho[r.chave]" :key="e">{{ e }}</li>
            </ul>
          </div>

          <FormularioPrescricao
            v-if="editando === r.chave"
            v-model="r.dados"
            :prefixo="`imp-${r.chave}-`"
            aceitar-sem-categoria
          />
          <template v-else>
            <CampoSelect v-model="r.dados.categoriaId" :opcoes="opcoesCategoria" aria-label="Grupo" />
            <ol class="list-decimal pl-5 text-sm">
              <li v-for="item in r.dados.itens" :key="item.id" class="whitespace-pre-line">
                <span v-if="nomeCondicao(r, item.condicaoId)" class="text-primary block text-xs font-semibold">
                  Condição: {{ nomeCondicao(r, item.condicaoId) }}
                </span>
                <template v-if="item.opcoes.length >= 2">
                  <span class="text-primary text-xs font-semibold">Opções equivalentes (escolher uma):</span>
                  <ul class="list-disc pl-4">
                    <li v-for="opcao in item.opcoes" :key="opcao.id">
                      {{ opcao.texto }}<span v-if="opcao.motivo" class="text-muted-foreground"> ({{ opcao.motivo }})</span>
                    </li>
                  </ul>
                </template>
                <template v-else>{{ item.opcoes[0]?.texto }}</template>
              </li>
            </ol>
            <p v-if="r.dados.alertas.length" class="text-muted-foreground text-sm">
              {{ r.dados.alertas.length }} {{ r.dados.alertas.length === 1 ? 'alerta' : 'alertas' }}
            </p>
            <div v-if="r.dados.receita" class="flex flex-col gap-1 text-sm">
              <p class="text-muted-foreground text-xs font-medium">Receita pronta</p>
              <p class="bg-muted/50 rounded-xl border p-2.5 whitespace-pre-line">{{ r.dados.receita }}</p>
            </div>
            <div v-if="r.dados.observacoes" class="flex flex-col gap-1 text-sm">
              <p class="text-muted-foreground text-xs font-medium">Observações</p>
              <p class="whitespace-pre-line">{{ r.dados.observacoes }}</p>
            </div>
          </template>

          <div class="grid grid-cols-3 gap-2">
            <Button variant="outline" size="touch" @click="editando = editando === r.chave ? null : r.chave">
              <X v-if="editando === r.chave" /><Pencil v-else /> {{ editando === r.chave ? 'Fechar' : 'Editar' }}
            </Button>
            <Button variant="destructive" size="touch" @click="descartar(r)"><Trash2 /> Descartar</Button>
            <Button size="touch" @click="aprovar(r)"><Check /> Aprovar</Button>
          </div>
        </CardContent>
      </Card>

      <div v-if="!rascunhos.length && lotesTerminados" class="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
        <p v-if="aprovadas">Revisão concluída. As aprovadas estão na lista como “importada — não revisada”.</p>
        <p v-else>Importação concluída sem nenhuma prescrição aprovada.</p>
        <div class="flex flex-wrap gap-2">
          <Button v-if="aprovadas" size="touch" as-child><RouterLink to="/prescricoes">Ver prescrições</RouterLink></Button>
          <Button size="touch" variant="outline" @click="recomecar">Importar outro PDF</Button>
        </div>
      </div>
    </template>

    <!-- ===== Escolha do PDF e do modo ===== -->
    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle>Escolher PDF</CardTitle>
          <CardDescription>PDFs grandes são enviados em lotes de {{ PAGINAS_POR_LOTE }} páginas, um de cada vez.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <input ref="entrada" type="file" accept="application/pdf,.pdf" class="hidden" @change="aoEscolher" />
          <Button size="touch" variant="outline" class="self-start" @click="entrada?.click()">
            <FileUp /> {{ arquivo ? 'Trocar PDF' : 'Escolher PDF' }}
          </Button>
          <p v-if="erroArquivo" role="alert" class="text-destructive text-sm">{{ erroArquivo }}</p>
          <p v-if="arquivo" class="text-sm">
            <span class="font-medium break-all">{{ arquivo.nome }}</span>
            <span class="text-muted-foreground"> · {{ tamanho(arquivo.bytes.length) }} · {{ arquivo.paginas }} {{ arquivo.paginas === 1 ? 'página' : 'páginas' }}</span>
          </p>

          <template v-if="arquivo">
            <label class="flex items-center gap-2 text-sm">
              <input v-model="usarIntervalo" type="checkbox" class="accent-primary size-5" />
              Importar só um intervalo de páginas
            </label>
            <div v-if="usarIntervalo" class="flex items-center gap-2">
              <CampoNumero v-model="paginaDe" class="w-24" aria-label="Da página" />
              <span class="text-muted-foreground text-sm">até</span>
              <CampoNumero v-model="paginaAte" class="w-24" aria-label="Até a página" />
            </div>
            <p v-if="erroIntervalo" role="alert" class="text-destructive text-sm">{{ erroIntervalo }}</p>
            <p v-else class="text-muted-foreground text-sm">{{ resumoLotes }}</p>
          </template>
        </CardContent>
      </Card>

      <!-- Alternativa sem chave: usar um chat no navegador e colar a resposta -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><MessagesSquare class="size-5" /> Usar um chat no navegador</CardTitle>
          <CardDescription>Sem chave de API: use o ChatGPT, Claude ou Gemini no navegador e cole a resposta aqui.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <ol class="list-decimal pl-5 text-sm">
            <li>Escolha o PDF acima. O app divide em lotes.</li>
            <li>Para cada lote, baixe o PDF do lote e copie o prompt.</li>
            <li>No chat, anexe o PDF do lote (<strong>sem dados de pacientes</strong>) e cole o prompt.</li>
            <li>Copie a resposta do chat (o JSON) e cole no campo do lote.</li>
          </ol>
          <Button size="touch" class="self-start" :disabled="!trechosPlanejados.length" @click="iniciar('chat')">
            <MessagesSquare /> {{ trechosPlanejados.length > 1 ? `Importar pelo chat (${trechosPlanejados.length} lotes)` : 'Importar pelo chat' }}
          </Button>
        </CardContent>
      </Card>
    </template>

    <DialogoConfirmar
      v-model:aberto="confirmarSaida"
      titulo="Sair da importação?"
      descricao="As prescrições ainda não aprovadas serão descartadas e os lotes que faltam não serão importados."
      rotulo-confirmar="Sair e descartar"
      perigoso
      @confirmar="responderSaida(true)"
      @cancelar="responderSaida(false)"
    />
    <DialogoConfirmar
      v-model:aberto="confirmarEncerrar"
      titulo="Encerrar a importação?"
      descricao="As prescrições ainda não aprovadas serão descartadas e os lotes que faltam não serão importados. As já aprovadas continuam salvas."
      rotulo-confirmar="Encerrar e descartar"
      perigoso
      @confirmar="recomecar"
    />
  </section>
</template>
