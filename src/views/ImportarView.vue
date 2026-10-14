<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { Check, FileUp, Loader2, Pencil, ShieldAlert, Sparkles, Trash2, TriangleAlert, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import FormularioPrescricao from '@/components/prescricoes/FormularioPrescricao.vue'
import { useAvisoSaida } from '@/composables/useAvisoSaida'
import { PROVEDORES } from '@/dominio/ia/provedores'
import { criarRascunhos, type RascunhoImportado } from '@/dominio/ia/rascunhos'
import { validarPrescricao } from '@/dominio/prescricoes/editar'
import { enviarParaIA } from '@/lib/enviarParaIA'
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
  erroEnvio.value = null
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

const intervalo = computed(() =>
  usarIntervalo.value && paginaDe.value !== null && paginaAte.value !== null ? { de: paginaDe.value, ate: paginaAte.value } : null,
)
const paginasEnviadas = computed(() =>
  !arquivo.value ? 0 : intervalo.value ? intervalo.value.ate - intervalo.value.de + 1 : arquivo.value.paginas,
)

/** Motivo para não poder enviar ainda (null = pode). */
const bloqueio = computed(() => {
  const a = arquivo.value
  if (!a) return 'Escolha um PDF.'
  if (!chave.value) return `Cadastre a chave de API do ${provedor.value.nome} em Ajustes.`
  if (usarIntervalo.value) {
    const { de, ate } = { de: paginaDe.value, ate: paginaAte.value }
    if (de === null || ate === null || !Number.isInteger(de) || !Number.isInteger(ate) || de < 1 || ate > a.paginas || de > ate) {
      return `Intervalo inválido: use páginas de 1 a ${a.paginas}, com "de" ≤ "até".`
    }
  }
  const limitePaginas = provedor.value.limites.paginas
  if (limitePaginas !== null && paginasEnviadas.value > limitePaginas) {
    return `${provedor.value.nome} aceita até ${limitePaginas} páginas por envio: escolha um intervalo menor.`
  }
  if (!usarIntervalo.value && a.bytes.length > provedor.value.limites.bytesPdf) {
    return `PDF grande demais para ${provedor.value.nome} (${provedor.value.limites.descricao}): escolha um intervalo de páginas.`
  }
  if (!confirmado.value) return 'Confirme o envio na caixa acima.'
  return null
})

// ===== Envio =====
const enviando = ref(false)
const erroEnvio = ref<string | null>(null)
let controlador: AbortController | null = null

const rascunhos = ref<RascunhoImportado[]>([])
const duvidasGerais = ref<string[]>([])
const editando = ref<string | null>(null)
const errosPorRascunho = ref<Record<string, string[]>>({})
const aprovadas = ref(0)

async function enviar() {
  if (bloqueio.value || !arquivo.value) return
  if (!navigator.onLine) {
    erroEnvio.value = 'Sem internet. A importação por IA é a única função do app que precisa de conexão.'
    return
  }
  enviando.value = true
  erroEnvio.value = null
  controlador = new AbortController()
  try {
    let pdf = arquivo.value.bytes
    if (intervalo.value) pdf = await recortarPaginas(pdf, intervalo.value.de, intervalo.value.ate)
    if (pdf.length > provedor.value.limites.bytesPdf) {
      erroEnvio.value = `O trecho escolhido tem ${tamanho(pdf.length)}, acima do limite do ${provedor.value.nome} (${provedor.value.limites.descricao}). Escolha menos páginas.`
      return
    }
    const r = await enviarParaIA(provedor.value, {
      pdf,
      intervalo: intervalo.value,
      modelo: modelo.value,
      chave: chave.value,
      sinal: controlador.signal,
    })
    if (!r.ok) {
      erroEnvio.value = r.erro
      return
    }
    rascunhos.value = criarRascunhos(r.resposta, categorias.todas)
    duvidasGerais.value = r.resposta.duvidas
    errosPorRascunho.value = {}
    aprovadas.value = 0
    if (rascunhos.value.length === 0) erroEnvio.value = 'A IA não encontrou prescrições neste PDF.'
  } catch (e) {
    erroEnvio.value = e instanceof Error ? e.message : String(e)
  } finally {
    enviando.value = false
    confirmado.value = false // confirmação vale para um envio só
    controlador = null
  }
}

function cancelar() {
  controlador?.abort()
}

// ===== Revisão =====
const opcoesCategoria = computed(() => [
  { valor: null as string | null, rotulo: ROTULO_SEM_CATEGORIA },
  ...categorias.dePrescricoes.map((c) => ({ valor: c.id as string | null, rotulo: c.nome })),
])

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
  rascunhos.value = []
  duvidasGerais.value = []
  aprovadas.value = 0
  arquivo.value = null
}

// Sair da tela com prescrições ainda não aprovadas as descarta.
const pendentes = computed(() => rascunhos.value.length > 0)
const { confirmarSaida, responderSaida } = useAvisoSaida(pendentes)
</script>

<template>
  <section class="flex flex-col gap-4 pb-6">
    <h1 class="flex items-center gap-2 text-2xl font-semibold"><Sparkles class="size-6" /> Importar PDF</h1>

    <!-- ===== Revisão ===== -->
    <template v-if="rascunhos.length || aprovadas">
      <div v-if="duvidasGerais.length" class="border-atencao bg-atencao/12 rounded-xl border p-3">
        <p class="flex items-center gap-2 font-semibold"><TriangleAlert class="text-atencao size-4" /> Dúvidas da IA sobre o documento</p>
        <ul class="mt-1 list-disc pl-5 text-sm">
          <li v-for="(d, i) in duvidasGerais" :key="i">{{ d }}</li>
        </ul>
      </div>

      <p class="text-muted-foreground text-sm">
        {{ rascunhos.length }} {{ rascunhos.length === 1 ? 'prescrição para revisar' : 'prescrições para revisar' }}
        <template v-if="aprovadas"> · {{ aprovadas }} {{ aprovadas === 1 ? 'aprovada' : 'aprovadas' }}</template>.
        Nada é salvo sem sua aprovação.
      </p>

      <Card v-for="r in rascunhos" :key="r.chave">
        <CardHeader>
          <CardTitle>{{ r.dados.titulo || 'Sem título' }}</CardTitle>
          <CardDescription v-if="r.categoriaSugerida">Categoria no documento: “{{ r.categoriaSugerida }}”</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
          <div v-if="r.dados.duvidasImportacao.length" class="border-atencao bg-atencao/12 rounded-lg border p-2.5 text-sm">
            <p class="font-semibold">Dúvidas da IA</p>
            <ul class="list-disc pl-5">
              <li v-for="(d, i) in r.dados.duvidasImportacao" :key="i">{{ d }}</li>
            </ul>
          </div>

          <div v-if="errosPorRascunho[r.chave]?.length" role="alert" class="border-critico bg-critico/12 rounded-lg border p-2.5 text-sm">
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
            <CampoSelect v-model="r.dados.categoriaId" :opcoes="opcoesCategoria" aria-label="Categoria" />
            <ol class="list-decimal pl-5 text-sm">
              <li v-for="item in r.dados.itens" :key="item.id" class="whitespace-pre-line">
                {{ item.texto }}
                <span v-if="item.alternativas.length" class="text-muted-foreground">
                  ({{ item.alternativas.length }} {{ item.alternativas.length === 1 ? 'alternativa' : 'alternativas' }})
                </span>
              </li>
            </ol>
            <p v-if="r.dados.alertas.length" class="text-muted-foreground text-sm">
              {{ r.dados.alertas.length }} {{ r.dados.alertas.length === 1 ? 'alerta' : 'alertas' }}
            </p>
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

      <div v-if="!rascunhos.length" class="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
        <p>Revisão concluída. As aprovadas estão na lista como “importada — não revisada”.</p>
        <div class="flex gap-2">
          <Button size="touch" as-child><RouterLink to="/prescricoes">Ver prescrições</RouterLink></Button>
          <Button size="touch" variant="outline" @click="recomecar">Importar outro PDF</Button>
        </div>
      </div>
    </template>

    <!-- ===== Escolha e envio ===== -->
    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle>Escolher PDF</CardTitle>
          <CardDescription>
            Provedor: {{ provedor.nome }} · modelo {{ modelo }} ({{ provedor.limites.descricao }}).
            <RouterLink to="/ajustes" class="text-primary underline-offset-2 hover:underline">Alterar em Ajustes</RouterLink>
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <input ref="entrada" type="file" accept="application/pdf,.pdf" class="hidden" @change="aoEscolher" />
          <Button size="touch" variant="outline" class="self-start" :disabled="enviando" @click="entrada?.click()">
            <FileUp /> {{ arquivo ? 'Trocar PDF' : 'Escolher PDF' }}
          </Button>
          <p v-if="erroArquivo" role="alert" class="text-destructive text-sm">{{ erroArquivo }}</p>
          <p v-if="arquivo" class="text-sm">
            <span class="font-medium break-all">{{ arquivo.nome }}</span>
            <span class="text-muted-foreground"> · {{ tamanho(arquivo.bytes.length) }} · {{ arquivo.paginas }} {{ arquivo.paginas === 1 ? 'página' : 'páginas' }}</span>
          </p>

          <template v-if="arquivo">
            <label class="flex items-center gap-2 text-sm">
              <input v-model="usarIntervalo" type="checkbox" class="accent-primary size-5" :disabled="enviando" />
              Enviar só um intervalo de páginas
            </label>
            <div v-if="usarIntervalo" class="flex items-center gap-2">
              <CampoNumero v-model="paginaDe" class="w-24" aria-label="Da página" />
              <span class="text-muted-foreground text-sm">até</span>
              <CampoNumero v-model="paginaAte" class="w-24" aria-label="Até a página" />
            </div>

            <label class="border-atencao bg-atencao/12 flex items-start gap-3 rounded-xl border p-3 text-sm">
              <input v-model="confirmado" type="checkbox" class="accent-primary mt-0.5 size-5 shrink-0" :disabled="enviando" />
              <span>
                <ShieldAlert class="text-atencao mr-1 inline size-4" />
                Confirmo que este PDF <strong>não contém dados de pacientes</strong> e autorizo enviá-lo ao
                <strong>{{ provedor.nome }}</strong>.
              </span>
            </label>
          </template>

          <p v-if="bloqueio && arquivo" class="text-muted-foreground text-sm">{{ bloqueio }}</p>
          <p v-if="!arquivo && !chave" class="text-muted-foreground text-sm">
            Cadastre a chave de API em <RouterLink to="/ajustes" class="text-primary underline">Ajustes</RouterLink>.
          </p>

          <div v-if="erroEnvio" role="alert" class="border-critico bg-critico/12 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <p>{{ erroEnvio }}</p>
            <p class="text-muted-foreground text-xs">Marque a confirmação de novo para tentar outra vez.</p>
          </div>

          <div class="flex gap-2">
            <Button size="touch" :disabled="!!bloqueio || enviando" @click="enviar">
              <Loader2 v-if="enviando" class="animate-spin" /><Sparkles v-else />
              {{ enviando ? 'Enviando…' : erroEnvio ? 'Tentar de novo' : 'Enviar para a IA' }}
            </Button>
            <Button v-if="enviando" size="touch" variant="outline" @click="cancelar">Cancelar</Button>
          </div>
          <p v-if="enviando" class="text-muted-foreground text-xs">Pode levar alguns minutos em PDFs grandes.</p>
        </CardContent>
      </Card>
    </template>

    <DialogoConfirmar
      v-model:aberto="confirmarSaida"
      titulo="Sair da revisão?"
      descricao="As prescrições ainda não aprovadas serão descartadas."
      rotulo-confirmar="Sair e descartar"
      perigoso
      @confirmar="responderSaida(true)"
      @cancelar="responderSaida(false)"
    />
  </section>
</template>
