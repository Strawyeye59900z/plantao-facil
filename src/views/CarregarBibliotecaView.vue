<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { FileUp, ShieldAlert, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LogoApp from '@/components/layout/LogoApp.vue'
import { carregarBibliotecaDoArquivo } from '@/lib/penDrive'
import { armazenamento } from '@/modo'

const router = useRouter()
const entrada = ref<HTMLInputElement | null>(null)
const erro = ref<string | null>(null)
const carregando = ref(false)

async function aoEscolher(evento: Event) {
  const arquivo = (evento.target as HTMLInputElement).files?.[0]
  if (!arquivo) return
  carregando.value = true
  erro.value = await carregarBibliotecaDoArquivo(arquivo)
  carregando.value = false
  if (entrada.value) entrada.value.value = ''
  if (!erro.value) {
    toast.success('Biblioteca carregada.')
    router.replace('/prescricoes')
  }
}
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-4 pt-4">
    <div class="flex items-center gap-3">
      <LogoApp class="size-10" />
      <div>
        <h1 class="text-2xl font-semibold md:text-3xl">Plantão Fácil</h1>
        <p class="text-muted-foreground text-sm">Modo pen drive — somente leitura</p>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Carregar biblioteca</CardTitle>
        <CardDescription>
          Escolha o arquivo de backup (.json) exportado do celular ou do seu PC.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <input ref="entrada" type="file" accept="application/json,.json" class="hidden" @change="aoEscolher" />
        <Button size="touch" :disabled="carregando" @click="entrada?.click()">
          <FileUp /> Escolher backup
        </Button>
        <p v-if="erro" role="alert" class="border-critico/35 bg-critico/10 rounded-xl border p-3 text-sm">{{ erro }}</p>
      </CardContent>
    </Card>

    <div class="border-atencao/45 bg-atencao/12 flex gap-3 rounded-xl border p-3 text-sm">
      <ShieldAlert class="text-atencao mt-0.5 size-5 shrink-0" />
      <p v-if="!armazenamento.emMemoria">
        A biblioteca fica salva <strong>neste navegador</strong>, e abre direto nas próximas vezes. Em PC
        compartilhado, use <strong>Ajustes → Apagar dados deste PC</strong> ao terminar.
      </p>
      <p v-else>
        <TriangleAlert class="mr-1 inline size-4" />
        Este navegador não permite salvar dados em arquivo aberto do pen drive. A biblioteca fica só
        <strong>enquanto esta aba estiver aberta</strong>; carregue o backup a cada uso.
      </p>
    </div>
  </section>
</template>
