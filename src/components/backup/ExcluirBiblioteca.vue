<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Download, Trash2 } from '@lucide/vue'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apagarBibliotecaInteira } from '@/db/exclusao'
import { lerBiblioteca } from '@/db/backup'
import { montarBackup, nomeArquivoBackup } from '@/dominio/backup/backup'
import { baixarArquivo } from '@/lib/arquivo'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { usePrescricoesStore } from '@/stores/prescricoes'

/** Ajustes: apaga de vez toda a biblioteca deste aparelho (prescrições, calculadoras, escalas, grupos e lixeira). */
const PALAVRA = 'EXCLUIR'

const prescricoes = usePrescricoesStore()
const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()
const configuracoes = useConfiguracoesStore()

const aberto = ref(false)
const digitado = ref('')
const baixou = ref(false)
const ocupado = ref(false)

const total = computed(() => prescricoes.todas.length + calculadoras.todas.length + categorias.todas.length)
const confirmado = computed(() => digitado.value.trim().toUpperCase() === PALAVRA)

function abrir() {
  digitado.value = ''
  baixou.value = false
  aberto.value = true
}

async function baixarBackup() {
  const agora = new Date()
  const conteudo = JSON.stringify(montarBackup(await lerBiblioteca(), agora.toISOString(), __APP_VERSION__), null, 2)
  baixarArquivo(nomeArquivoBackup(agora), conteudo)
  await configuracoes.registrarBackup(agora.toISOString())
  baixou.value = true
  toast.success('Backup baixado.')
}

async function excluir() {
  if (!confirmado.value) return
  ocupado.value = true
  try {
    await apagarBibliotecaInteira()
    await Promise.all([prescricoes.carregar(), calculadoras.carregar(), categorias.carregar()])
    aberto.value = false
    toast.success('Biblioteca excluída deste aparelho.')
  } catch (erro) {
    toast.error(`Nada foi apagado: ${erro instanceof Error ? erro.message : String(erro)}`)
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2"><Trash2 class="size-5" /> Excluir biblioteca</CardTitle>
      <CardDescription>
        Apaga de vez prescrições, calculadoras, escalas, grupos e a lixeira deste aparelho. Ajustes e chave de IA ficam.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button size="touch" variant="destructive" class="self-start" :disabled="total === 0" @click="abrir">
        <Trash2 /> Excluir biblioteca inteira
      </Button>
      <p v-if="total === 0" class="text-muted-foreground mt-2 text-sm">A biblioteca já está vazia.</p>
    </CardContent>
  </Card>

  <AlertDialog v-model:open="aberto">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir a biblioteca inteira?</AlertDialogTitle>
        <AlertDialogDescription>
          Tudo será apagado deste aparelho e <strong>não há como desfazer</strong>: {{ prescricoes.todas.length }}
          {{ prescricoes.todas.length === 1 ? 'prescrição' : 'prescrições' }}, {{ calculadoras.todas.length }}
          {{ calculadoras.todas.length === 1 ? 'calculadora ou escala' : 'calculadoras e escalas' }} e
          {{ categorias.todas.length }} {{ categorias.todas.length === 1 ? 'grupo' : 'grupos' }}, contando a lixeira.
          Baixe um backup antes se quiser poder recuperar.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <Button size="touch" variant="outline" @click="baixarBackup">
        <Download /> {{ baixou ? 'Baixar de novo' : 'Baixar backup antes' }}
      </Button>
      <p v-if="baixou" class="text-sm text-emerald-700 dark:text-emerald-400">Backup baixado.</p>

      <label class="flex flex-col gap-1.5 text-sm">
        Para confirmar, digite <strong>{{ PALAVRA }}</strong>
        <Input v-model="digitado" autocomplete="off" autocapitalize="characters" spellcheck="false" :placeholder="PALAVRA" />
      </label>

      <AlertDialogFooter>
        <AlertDialogCancel size="touch">Cancelar</AlertDialogCancel>
        <Button size="touch" variant="destructive" :disabled="!confirmado || ocupado" @click="excluir">
          Excluir tudo
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
