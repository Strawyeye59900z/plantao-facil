<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { MODELOS, type ModeloTranscricao, useTranscricao } from '@/composables/useTranscricao'

/**
 * Página de teste da Fase 1: grava e transcreve no aparelho, sem enviar nada para servidor.
 */
const t = useTranscricao()
const modeloEscolhido = ref<ModeloTranscricao>('base')

onBeforeUnmount(() => t.liberar())

const rotulosStatus: Record<string, string> = {
  'sem-modelo': 'Modelo não carregado',
  'carregando-modelo': 'Carregando modelo',
  pronto: 'Pronto para gravar',
  gravando: 'Gravando',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
  erro: 'Erro',
}
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
    <header>
      <h1 class="text-2xl font-bold">Transcrição no aparelho (teste)</h1>
      <p class="text-muted-foreground text-sm">O áudio não sai do celular. Só o texto aparece aqui.</p>
    </header>

    <p class="font-semibold" role="status" aria-live="polite">
      {{ rotulosStatus[t.status.value] }}
      <span v-if="t.dispositivo.value" class="text-muted-foreground font-normal">· {{ t.dispositivo.value }}</span>
    </p>

    <p v-if="t.progresso.value" class="text-sm">
      Baixando {{ t.progresso.value.arquivo }}: {{ t.progresso.value.porcentagem }}%
    </p>

    <p v-if="t.erro.value" class="text-critico text-sm" role="alert">{{ t.erro.value }}</p>

    <div class="flex flex-wrap gap-2">
      <Button size="touch" variant="outline" @click="t.carregarModelo(MODELOS[modeloEscolhido])">
        Carregar modelo ({{ modeloEscolhido }})
      </Button>
      <Button size="touch" variant="ghost" @click="modeloEscolhido = modeloEscolhido === 'base' ? 'small' : 'base'">
        Trocar para {{ modeloEscolhido === 'base' ? 'small' : 'base' }}
      </Button>
      <Button size="touch" :disabled="t.status.value !== 'pronto' && t.status.value !== 'pausado'" @click="t.iniciar()">
        Gravar
      </Button>
      <Button size="touch" variant="outline" :disabled="t.status.value !== 'gravando'" @click="t.pausar()">Pausar</Button>
      <Button size="touch" variant="outline" :disabled="t.status.value !== 'pausado'" @click="t.retomar()">Retomar</Button>
      <Button size="touch" variant="outline" :disabled="t.status.value !== 'gravando' && t.status.value !== 'pausado'" @click="t.encerrar()">
        Encerrar
      </Button>
      <Button size="touch" variant="ghost" @click="t.descartar()">Descartar</Button>
    </div>

    <p v-if="t.filaPendente.value" class="text-muted-foreground text-sm">
      Transcrevendo {{ t.filaPendente.value }} bloco(s)…
    </p>

    <section aria-labelledby="titulo-texto" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-texto" class="mb-2 text-sm font-semibold">Texto transcrito</h2>
      <p class="min-h-24 whitespace-pre-wrap text-base leading-relaxed">{{ t.texto.value || 'Nada transcrito ainda.' }}</p>
    </section>
  </main>
</template>
