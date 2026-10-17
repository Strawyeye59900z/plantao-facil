<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Copy, Pencil, Star, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'
import UsoCalculadora from '@/components/calculadoras/UsoCalculadora.vue'
import { cn } from '@/lib/utils'
import { MODO_PENDRIVE } from '@/modo'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'
import { useRecentesStore } from '@/stores/recentes'

const route = useRoute()
const router = useRouter()
const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

const id = String(route.params.id)
const calculadora = computed(() => calculadoras.obter(id))
if (calculadora.value && calculadora.value.excluidoEm === null) useRecentesStore().registrar('calculadora', id)

async function duplicar() {
  const copia = await calculadoras.duplicar(id)
  toast.success('Calculadora duplicada.')
  router.push(`/calculadoras/${copia.id}/editar`)
}

const confirmarLixeira = ref(false)
async function moverParaLixeira() {
  const nome = calculadora.value?.nome
  await calculadoras.moverParaLixeira(id)
  router.replace('/calculadoras')
  toast(`“${nome}” foi para a lixeira.`, { action: { label: 'Desfazer', onClick: () => calculadoras.restaurar(id) } })
}
</script>

<template>
  <section v-if="calculadora" class="flex flex-col gap-5 pb-4">
    <header class="flex flex-col gap-3">
      <p class="text-muted-foreground bg-secondary flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
        <IconeCategoria :icone="categorias.obter(calculadora.categoriaId)?.icone" class="size-3.5" />
        {{ categorias.nome(calculadora.categoriaId) }}
      </p>
      <div class="flex items-start gap-2">
        <h1 class="flex-1 text-2xl leading-tight font-semibold md:text-3xl">{{ calculadora.nome }}</h1>
        <Star
          v-if="MODO_PENDRIVE"
          :class="cn('m-2.5 size-6 shrink-0', calculadora.favorito ? 'fill-atencao text-atencao' : 'hidden')"
          aria-label="Favorita"
        />
        <Button
          v-else
          variant="ghost"
          size="icon-touch"
          :aria-label="calculadora.favorito ? 'Remover dos favoritos' : 'Favoritar'"
          :aria-pressed="calculadora.favorito"
          @click="calculadoras.alternarFavorito(id)"
        >
          <Star :class="cn('size-6', calculadora.favorito && 'fill-atencao text-atencao')" />
        </Button>
      </div>
      <p v-if="calculadora.descricao" class="text-muted-foreground text-sm whitespace-pre-line">{{ calculadora.descricao }}</p>
      <div v-if="!calculadora.excluidoEm && !MODO_PENDRIVE" class="-ml-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="touch" class="text-muted-foreground px-3 text-sm" as-child>
          <RouterLink :to="`/calculadoras/${id}/editar`"><Pencil /> Editar</RouterLink>
        </Button>
        <Button variant="ghost" size="touch" class="text-muted-foreground px-3 text-sm" @click="duplicar"><Copy /> Duplicar</Button>
        <Button variant="ghost" size="touch" class="text-muted-foreground hover:text-destructive px-3 text-sm" @click="confirmarLixeira = true">
          <Trash2 /> Excluir
        </Button>
      </div>
    </header>

    <div v-if="calculadora.excluidoEm" class="bg-muted rounded-2xl p-3 text-sm">Esta calculadora está na lixeira.</div>

    <UsoCalculadora :calculadora="calculadora" />

    <div v-if="calculadora.referencia" class="flex flex-col gap-1.5 border-t px-1 pt-4">
      <h2 class="text-muted-foreground text-xs font-medium">Referência</h2>
      <p class="text-muted-foreground text-sm whitespace-pre-line">{{ calculadora.referencia }}</p>
    </div>

    <DialogoConfirmar
      v-model:aberto="confirmarLixeira"
      titulo="Mover para a lixeira?"
      descricao="Você pode restaurar depois, pela Lixeira."
      rotulo-confirmar="Mover para a lixeira"
      perigoso
      @confirmar="moverParaLixeira"
    />
  </section>

  <section v-else class="flex flex-col items-start gap-4">
    <h1 class="text-2xl font-semibold md:text-3xl">Calculadora não encontrada</h1>
    <Button size="touch" as-child><RouterLink to="/calculadoras">Voltar para a lista</RouterLink></Button>
  </section>
</template>
