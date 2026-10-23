<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { Download } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ArquivoBackup } from '@/dominio/tipos'
import { baixarPacote } from '@/lib/compartilhar/compartilhar'
import PreviaMesclagem from './PreviaMesclagem.vue'

/**
 * Receber prescrições de um colega: digita o código, vê o que é novo, igual ou conflitante e mescla.
 * O que entra fica marcado "Recebida de colega" e "não revisada".
 */
const codigo = ref('')
const buscando = ref(false)
const erro = ref<string | null>(null)
const pacote = shallowRef<ArquivoBackup | null>(null)

function limpar() {
  pacote.value = null
  erro.value = null
}

async function buscar() {
  limpar()
  buscando.value = true
  try {
    const leitura = await baixarPacote(codigo.value)
    if (!leitura.ok) erro.value = leitura.erro
    else pacote.value = leitura.backup
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  } finally {
    buscando.value = false
  }
}

function concluir() {
  limpar()
  codigo.value = ''
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2"><Download class="size-5" /> Receber de colega</CardTitle>
      <CardDescription>
        Digite o código que o colega passou. Você vê o que é novo antes de importar. Tudo o que chegar fica marcado como
        “Recebida de colega” e “revisar antes de usar”.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <form class="flex gap-2" @submit.prevent="buscar">
        <Input
          v-model="codigo"
          class="h-11 flex-1 font-mono tracking-widest uppercase"
          aria-label="Código do colega"
          placeholder="XXXX-XXXX"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
        />
        <Button size="touch" type="submit" :disabled="buscando || !codigo.trim()">
          {{ buscando ? 'Buscando…' : 'Buscar' }}
        </Button>
      </form>

      <p v-if="erro" role="alert" class="border-critico/35 bg-critico/10 rounded-xl border p-3 text-sm">{{ erro }}</p>

      <PreviaMesclagem
        v-if="pacote"
        :pacote="pacote"
        marcar-como-recebidas
        rotulo-origem="Do colega"
        @concluido="concluir"
        @cancelar="limpar"
      />
    </CardContent>
  </Card>
</template>
