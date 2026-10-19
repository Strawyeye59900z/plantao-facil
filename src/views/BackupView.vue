<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { Download, FileUp, GitMerge, Replace, Share2, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import CartaoConflito from '@/components/backup/CartaoConflito.vue'
import { gravarNaBiblioteca, lerBiblioteca, substituirBiblioteca } from '@/db/backup'
import {
  aplicarMesclagem,
  contarSituacoes,
  lerBackup,
  montarBackup,
  nomeArquivoBackup,
  planejarMesclagem,
  type Escolhas,
  type ItemPlano,
  type PlanoMesclagem,
} from '@/dominio/backup/backup'
import type { ArquivoBackup, Entidade } from '@/dominio/tipos'
import { baixarArquivo, compartilharArquivo, podeCompartilharArquivo } from '@/lib/arquivo'
import { cn } from '@/lib/utils'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { usePrescricoesStore } from '@/stores/prescricoes'

const configuracoes = useConfiguracoesStore()
const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()

// ===== Exportar =====
const podeCompartilhar = podeCompartilharArquivo()

const ultimoBackup = computed(() => {
  const em = configuracoes.config.ultimoBackupEm
  if (!em) return null
  const dias = Math.floor((Date.now() - new Date(em).getTime()) / 86_400_000)
  const quando = new Date(em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return { dias, texto: dias === 0 ? `hoje (${quando})` : `há ${dias} ${dias === 1 ? 'dia' : 'dias'} (${quando})` }
})

async function gerarBackup() {
  const agora = new Date()
  const conteudo = JSON.stringify(montarBackup(await lerBiblioteca(), agora.toISOString(), __APP_VERSION__), null, 2)
  return { nome: nomeArquivoBackup(agora), conteudo, agora }
}

async function baixar() {
  const { nome, conteudo, agora } = await gerarBackup()
  baixarArquivo(nome, conteudo)
  await configuracoes.registrarBackup(agora.toISOString())
  toast.success('Backup baixado.')
}

async function compartilhar() {
  const { nome, conteudo, agora } = await gerarBackup()
  try {
    if (await compartilharArquivo(nome, conteudo)) {
      await configuracoes.registrarBackup(agora.toISOString())
    }
  } catch {
    toast.error('Não foi possível compartilhar. Use "Baixar backup".')
  }
}

// ===== Importar =====
const entradaArquivo = ref<HTMLInputElement | null>(null)
const nomeArquivo = ref('')
const erroLeitura = ref<string | null>(null)
const backup = shallowRef<ArquivoBackup | null>(null)
const plano = shallowRef<PlanoMesclagem | null>(null)
const modo = ref<'mesclar' | 'substituir'>('mesclar')
const escolhas = ref<Escolhas>({})
const importando = ref(false)

function limparImportacao() {
  nomeArquivo.value = ''
  erroLeitura.value = null
  backup.value = null
  plano.value = null
  escolhas.value = {}
  modo.value = 'mesclar'
  if (entradaArquivo.value) entradaArquivo.value.value = ''
}

async function aoEscolherArquivo(evento: Event) {
  const arquivo = (evento.target as HTMLInputElement).files?.[0]
  if (!arquivo) return
  limparImportacao()
  nomeArquivo.value = arquivo.name
  const leitura = lerBackup(await arquivo.text())
  if (!leitura.ok) {
    erroLeitura.value = leitura.erro
    return
  }
  backup.value = leitura.backup
  plano.value = planejarMesclagem(await lerBiblioteca(), leitura.backup)
  usarMaisRecentes()
}

const resumo = computed(() => {
  if (!plano.value || !backup.value) return []
  const b = backup.value
  return [
    { rotulo: 'Prescrições', total: b.prescricoes.length, lixeira: b.prescricoes.filter((p) => p.excluidoEm).length, ...contarSituacoes(plano.value.prescricoes) },
    { rotulo: 'Grupos', total: b.categorias.length, lixeira: b.categorias.filter((c) => c.excluidoEm).length, ...contarSituacoes(plano.value.categorias) },
    { rotulo: 'Calculadoras', total: b.calculadoras.length, lixeira: b.calculadoras.filter((c) => c.excluidoEm).length, ...contarSituacoes(plano.value.calculadoras) },
  ]
})

function nomeEntidade(e: Entidade) {
  const x = e as Entidade & { titulo?: string; nome?: string }
  return x.titulo ?? x.nome ?? e.id
}

const conflitos = computed(() => {
  if (!plano.value) return []
  const lista: { item: ItemPlano<Entidade>; tipo: string }[] = [
    ...plano.value.categorias.map((item) => ({ item, tipo: 'Grupo' })),
    ...plano.value.prescricoes.map((item) => ({ item, tipo: 'Prescrição' })),
    ...plano.value.calculadoras.map((item) => ({ item, tipo: 'Calculadora' })),
  ]
  return lista.filter((c) => c.item.situacao === 'conflito')
})

function usarMaisRecentes() {
  const novo: Escolhas = {}
  for (const { item } of conflitos.value) novo[item.id] = item.maisRecente
  escolhas.value = novo
}

const aGravar = computed(() => (plano.value ? aplicarMesclagem(plano.value, escolhas.value) : null))
const totalAGravar = computed(() =>
  aGravar.value ? aGravar.value.prescricoes.length + aGravar.value.categorias.length + aGravar.value.calculadoras.length : 0,
)

async function recarregarStores() {
  await Promise.all([prescricoes.carregar(), categorias.carregar(), useCalculadorasStore().carregar()])
}

async function mesclar() {
  if (!aGravar.value) return
  importando.value = true
  try {
    await gravarNaBiblioteca(aGravar.value)
    await recarregarStores()
    toast.success(`Importação concluída: ${totalAGravar.value} ${totalAGravar.value === 1 ? 'registro gravado' : 'registros gravados'}.`)
    limparImportacao()
  } catch (erro) {
    toast.error(`A importação falhou e nada foi alterado: ${erro instanceof Error ? erro.message : String(erro)}`)
  } finally {
    importando.value = false
  }
}

const confirmarSubstituir = ref(false)

async function substituir(baixarAntes: boolean) {
  if (!backup.value) return
  confirmarSubstituir.value = false
  importando.value = true
  try {
    if (baixarAntes) await baixar()
    await substituirBiblioteca({
      prescricoes: backup.value.prescricoes,
      calculadoras: backup.value.calculadoras,
      categorias: backup.value.categorias,
    })
    await recarregarStores()
    toast.success('Biblioteca substituída pelo backup.')
    limparImportacao()
  } catch (erro) {
    toast.error(`A substituição falhou e nada foi alterado: ${erro instanceof Error ? erro.message : String(erro)}`)
  } finally {
    importando.value = false
  }
}

const totalNoAparelho = computed(() => prescricoes.todas.length)
</script>

<template>
  <section class="flex flex-col gap-4 pb-6">
    <h1 class="text-2xl font-semibold md:text-3xl">Backup</h1>

    <!-- Exportar -->
    <Card>
      <CardHeader>
        <CardTitle>Exportar biblioteca</CardTitle>
        <CardDescription>
          Prescrições, grupos e calculadoras (inclusive a lixeira). Tema e chaves de IA não entram.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <p
          :class="cn(
            'flex items-center gap-2 text-sm',
            (!ultimoBackup || ultimoBackup.dias >= 7) && 'text-atencao font-medium',
          )"
        >
          <TriangleAlert v-if="!ultimoBackup || ultimoBackup.dias >= 7" class="size-4 shrink-0" />
          {{ ultimoBackup ? `Último backup: ${ultimoBackup.texto}` : 'Nenhum backup feito neste aparelho.' }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button size="touch" @click="baixar"><Download /> Baixar backup</Button>
          <Button v-if="podeCompartilhar" size="touch" variant="outline" @click="compartilhar">
            <Share2 /> Compartilhar
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Importar -->
    <Card>
      <CardHeader>
        <CardTitle>Importar backup</CardTitle>
        <CardDescription>Você vê o que vai mudar antes de confirmar.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <input
          ref="entradaArquivo"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="aoEscolherArquivo"
        />
        <Button size="touch" variant="outline" class="self-start" :disabled="importando" @click="entradaArquivo?.click()">
          <FileUp /> Escolher arquivo
        </Button>
        <p v-if="nomeArquivo" class="text-muted-foreground text-sm break-all">{{ nomeArquivo }}</p>

        <p v-if="erroLeitura" role="alert" class="border-critico/35 bg-critico/10 rounded-xl border p-3 text-sm">
          {{ erroLeitura }}
        </p>

        <template v-if="plano && backup">
          <p class="text-muted-foreground text-sm">
            Backup de {{ new Date(backup.exportadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }}
            (app {{ backup.versaoApp }}).
          </p>

          <!-- Pré-visualização -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-muted-foreground text-left text-xs">
                <tr>
                  <th class="py-1 font-medium"></th>
                  <th class="py-1 text-right font-medium">No arquivo</th>
                  <th class="py-1 text-right font-medium">Novos</th>
                  <th class="py-1 text-right font-medium">Iguais</th>
                  <th class="py-1 text-right font-medium">Conflitos</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="linha in resumo" :key="linha.rotulo" class="border-t">
                  <td class="py-2">{{ linha.rotulo }}</td>
                  <td class="py-2 text-right">
                    {{ linha.total }}<span v-if="linha.lixeira" class="text-muted-foreground"> ({{ linha.lixeira }} na lixeira)</span>
                  </td>
                  <td class="py-2 text-right">{{ linha.novo }}</td>
                  <td class="py-2 text-right">{{ linha.igual }}</td>
                  <td :class="cn('py-2 text-right', linha.conflito && 'text-atencao font-semibold')">{{ linha.conflito }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="plano.categoriasUnificadas.length" class="text-muted-foreground text-sm">
            Grupos com o mesmo nome serão juntados:
            {{ plano.categoriasUnificadas.map((c) => c.nome).join(', ') }}.
          </p>

          <!-- Modo -->
          <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modo de importação">
            <button
              v-for="opcao in [
                { valor: 'mesclar', rotulo: 'Mesclar', descricao: 'Junta com o que já existe', icone: GitMerge },
                { valor: 'substituir', rotulo: 'Substituir', descricao: 'Apaga e usa só o arquivo', icone: Replace },
              ] as const"
              :key="opcao.valor"
              type="button"
              role="radio"
              :aria-checked="modo === opcao.valor"
              :class="cn(
                'flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left',
                modo === opcao.valor ? 'border-primary/50 bg-primary/10' : 'hover:bg-accent/70 border-border',
              )"
              @click="modo = opcao.valor"
            >
              <span class="flex items-center gap-2 font-semibold"><component :is="opcao.icone" class="size-4" /> {{ opcao.rotulo }}</span>
              <span class="text-muted-foreground text-xs">{{ opcao.descricao }}</span>
            </button>
          </div>

          <!-- Mesclar -->
          <template v-if="modo === 'mesclar'">
            <div v-if="conflitos.length" class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold">Conflitos ({{ conflitos.length }})</h3>
                <Button size="sm" variant="ghost" @click="usarMaisRecentes">Usar sempre a mais recente</Button>
              </div>
              <CartaoConflito
                v-for="c in conflitos"
                :key="c.item.id"
                v-model="escolhas[c.item.id]!"
                :item="c.item"
                :tipo="c.tipo"
                :nome="nomeEntidade"
              />
            </div>
            <p v-if="totalAGravar === 0" class="text-muted-foreground text-sm">
              Nada a importar: o aparelho já tem tudo o que está no arquivo.
            </p>
            <Button size="touch" :disabled="importando || totalAGravar === 0" @click="mesclar">
              <GitMerge /> Importar ({{ totalAGravar }} {{ totalAGravar === 1 ? 'registro' : 'registros' }})
            </Button>
          </template>

          <!-- Substituir -->
          <template v-else>
            <p class="border-critico/35 bg-critico/10 rounded-xl border p-3 text-sm">
              A biblioteca deste aparelho ({{ totalNoAparelho }} {{ totalNoAparelho === 1 ? 'prescrição' : 'prescrições' }},
              inclusive a lixeira) será apagada e trocada pela do arquivo.
            </p>
            <Button size="touch" variant="destructive" :disabled="importando" @click="confirmarSubstituir = true">
              <Replace /> Substituir biblioteca
            </Button>
          </template>

          <Button size="touch" variant="ghost" class="self-start" :disabled="importando" @click="limparImportacao">
            Cancelar importação
          </Button>
        </template>
      </CardContent>
    </Card>

    <AlertDialog v-model:open="confirmarSubstituir">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Substituir a biblioteca?</AlertDialogTitle>
          <AlertDialogDescription>
            Antes de apagar, recomendo baixar um backup do que está neste aparelho agora.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="touch">Cancelar</AlertDialogCancel>
          <Button size="touch" variant="outline" @click="substituir(false)">Substituir sem baixar</Button>
          <Button size="touch" variant="destructive" @click="substituir(true)">Baixar backup e substituir</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
