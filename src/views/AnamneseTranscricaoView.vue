<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { MODELOS, type ModeloTranscricao, useTranscricao } from '@/composables/useTranscricao'
import { useDitadoLocal } from '@/composables/useDitadoLocal'
import { lerToken, salvarToken } from '@/lib/anamnese/servidor'

/**
 * Página de teste: transcrição pela API do servidor (Groq), ou no próprio aparelho (modo local).
 */
const t = useTranscricao()
const modeloEscolhido = ref<ModeloTranscricao>('small')
const d = useDitadoLocal()
void d.verificar()

const token = ref(lerToken())
t.definirToken(token.value)
t.prepararServidor()

function salvarTokenDigitado() {
  salvarToken(token.value)
  t.definirToken(token.value.trim())
}

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
      <h1 class="text-2xl font-bold">Transcrição (teste)</h1>
      <p class="text-muted-foreground text-sm">
        Modo servidor: o áudio vai para a API da UPA e volta só o texto. Modo local: tudo no aparelho.
      </p>
    </header>

    <section aria-labelledby="titulo-token" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-token" class="mb-2 text-sm font-semibold">Token da API (uma vez por aparelho)</h2>
      <div class="flex gap-2">
        <input
          v-model="token"
          type="password"
          autocomplete="off"
          class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base"
          aria-label="Token de acesso à API"
        />
        <Button size="touch" variant="outline" @click="salvarTokenDigitado">Salvar</Button>
      </div>
      <p class="text-muted-foreground mt-2 text-sm">Modo atual: <strong>{{ t.modo.value }}</strong></p>
    </section>

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
      <Button size="touch" variant="ghost" @click="modeloEscolhido = modeloEscolhido === 'small' ? 'base' : 'small'">
        Trocar para {{ modeloEscolhido === 'small' ? 'base' : 'small' }}
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

    <section aria-labelledby="titulo-ditado" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-ditado" class="mb-2 text-base font-semibold">Ditado do navegador (no aparelho)</h2>
      <p class="text-muted-foreground mb-3 text-sm">
        Usa o reconhecimento de voz do Chrome, forçado a rodar só no aparelho. Se o pacote de português
        não estiver instalado, o navegador não inicia o ditado.
      </p>
      <p class="mb-3 text-sm" role="status">
        Pacote pt-BR: <strong>{{ d.disponibilidade.value }}</strong>
      </p>
      <div class="mb-3 flex flex-wrap gap-2">
        <Button size="touch" variant="outline" @click="d.verificar()">Verificar pacote</Button>
        <Button
          v-if="d.disponibilidade.value === 'downloadable'"
          size="touch"
          variant="outline"
          @click="d.instalar().then(() => d.verificar())"
        >
          Instalar pacote pt-BR
        </Button>
        <Button v-if="!d.ditando.value" size="touch" :disabled="d.disponibilidade.value !== 'available'" @click="d.iniciar()">
          Ditar (local)
        </Button>
        <Button v-else size="touch" variant="outline" @click="d.parar()">Parar ditado</Button>
      </div>
      <p v-if="d.erro.value" class="text-critico mb-2 text-sm" role="alert">{{ d.erro.value }}</p>
      <p class="min-h-16 whitespace-pre-wrap text-base leading-relaxed">{{ d.texto.value || 'Nada ditado ainda.' }}</p>
    </section>
  </main>
</template>
