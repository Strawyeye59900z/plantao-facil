<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Smartphone } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { celular, conectarCelular, encerrarCelular, encerrarCodigoPc, garantirCodigoPc, gerarCodigoPc, pc } from '@/lib/anamnese/estado'

/**
 * Sincronização com o celular, nas Configurações. No PC mostra o código para digitar no celular;
 * depois que o celular conecta, o código some e aparece "Sincronizado". No celular, o campo para
 * digitar o código do PC.
 */
const ehCelular = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
const codigoDigitado = ref('')

onMounted(() => {
  if (!ehCelular) void garantirCodigoPc()
})

async function conectar() {
  await conectarCelular(codigoDigitado.value)
  if (celular.conectado.value) codigoDigitado.value = ''
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2"><Smartphone class="size-5" /> Sincronização com o celular</CardTitle>
      <CardDescription>Usa uma sessão de 12 horas sem uso. Os dados não são salvos neste aparelho.</CardDescription>
    </CardHeader>

    <!-- PC -->
    <CardContent v-if="!ehCelular" class="flex flex-col gap-3">
      <template v-if="pc.sessao.value && pc.bloco.value">
        <p class="text-primary text-2xl font-semibold">Sincronizado</p>
        <p class="text-muted-foreground text-sm">{{ pc.status.value }}</p>
      </template>
      <template v-else-if="pc.sessao.value">
        <p class="text-sm">Digite este código no celular, em Ajustes:</p>
        <p class="font-mono text-3xl font-bold tracking-widest" aria-label="Código de sincronização">{{ pc.codigo.value }}</p>
        <p class="text-muted-foreground text-sm">{{ pc.status.value }}</p>
      </template>
      <p v-else class="text-muted-foreground text-sm">{{ pc.status.value }}</p>

      <p v-if="pc.erro.value" class="text-critico text-sm" role="alert">{{ pc.erro.value }}</p>

      <div class="flex flex-wrap gap-2">
        <Button v-if="pc.sessao.value" size="touch" variant="destructive" @click="encerrarCodigoPc">Encerrar sessão</Button>
        <Button v-else size="touch" variant="outline" @click="gerarCodigoPc">Gerar código</Button>
      </div>
    </CardContent>

    <!-- Celular -->
    <CardContent v-else class="flex flex-col gap-3">
      <template v-if="celular.conectado.value">
        <p class="text-primary text-2xl font-semibold">Sincronizado</p>
        <p v-if="celular.aviso.value" class="text-muted-foreground text-sm" role="status">{{ celular.aviso.value }}</p>
        <Button size="touch" variant="destructive" class="self-start" @click="encerrarCelular">Encerrar sessão</Button>
      </template>
      <template v-else>
        <p class="text-sm">Digite o código que aparece na tela do PC, em Ajustes.</p>
        <div class="flex gap-2">
          <input
            v-model="codigoDigitado"
            class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base uppercase"
            aria-label="Código do PC"
            placeholder="Código de 8 caracteres"
            autocomplete="off"
            spellcheck="false"
          />
          <Button size="touch" :disabled="!codigoDigitado.trim()" @click="conectar">Conectar</Button>
        </div>
      </template>
      <p v-if="celular.erro.value" class="text-critico text-sm" role="alert">{{ celular.erro.value }}</p>
    </CardContent>
  </Card>
</template>
