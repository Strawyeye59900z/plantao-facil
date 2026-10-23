<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { Download, Upload } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ArquivoBackup } from '@/dominio/tipos'
import { sessaoDeSincronizacao } from '@/lib/anamnese/estado'
import { enviarBiblioteca, receberBiblioteca } from '@/lib/compartilhar/entreAparelhos'
import PreviaMesclagem from './PreviaMesclagem.vue'

/**
 * Prescrições entre o PC e o celular, na área de sincronização de Ajustes. Usa a mesma sessão (o mesmo
 * código) da transcrição: só aparece com a sincronização ativa. Receber mescla, sem apagar nada.
 */
const sessao = computed(() => sessaoDeSincronizacao())
const ocupado = ref(false)
const erro = ref<string | null>(null)
const pacote = shallowRef<ArquivoBackup | null>(null)

async function enviar() {
  if (!sessao.value) return
  erro.value = null
  ocupado.value = true
  try {
    await enviarBiblioteca(sessao.value)
    toast.success('Biblioteca enviada. No outro aparelho, toque em “Receber biblioteca”.')
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  } finally {
    ocupado.value = false
  }
}

async function receber() {
  if (!sessao.value) return
  erro.value = null
  pacote.value = null
  ocupado.value = true
  try {
    const leitura = await receberBiblioteca(sessao.value)
    if (!leitura) toast.info('O outro aparelho ainda não enviou a biblioteca. Toque em “Enviar biblioteca” lá.')
    else if (!leitura.ok) erro.value = leitura.erro
    else pacote.value = leitura.backup
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <div v-if="sessao" class="flex flex-col gap-3">
    <div>
      <h3 class="font-semibold">Prescrições</h3>
      <p class="text-muted-foreground text-sm">
        Leva a biblioteca de um aparelho para o outro, pelo mesmo código. Quem recebe vê o que muda e escolhe; nada é apagado.
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button size="touch" variant="outline" :disabled="ocupado" @click="enviar"><Upload /> Enviar biblioteca</Button>
      <Button size="touch" variant="outline" :disabled="ocupado" @click="receber"><Download /> Receber biblioteca</Button>
    </div>
    <p v-if="erro" role="alert" class="text-critico text-sm">{{ erro }}</p>
    <PreviaMesclagem
      v-if="pacote"
      :pacote="pacote"
      :marcar-como-recebidas="false"
      rotulo-origem="Do outro aparelho"
      @concluido="pacote = null"
      @cancelar="pacote = null"
    />
  </div>
</template>
