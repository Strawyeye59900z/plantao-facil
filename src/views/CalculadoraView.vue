<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, Copy, Ellipsis, Pencil, Star, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'
import UsoCalculadora from '@/components/calculadoras/UsoCalculadora.vue'
import { cn } from '@/lib/utils'
import { MODO_PENDRIVE } from '@/modo'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'

/** Atende as duas áreas: /calculadoras/:id e /escalas/:id. */
const route = useRoute()
const router = useRouter()
const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

const id = computed(() => String(route.params.id))
const calculadora = computed(() => calculadoras.obter(id.value))
// A área vem do próprio item; se a rota for da outra área, troca para a rota certa.
const escala = computed(() => (calculadora.value ? calculadora.value.area === 'escala' : route.path.startsWith('/escalas')))
const base = computed(() => (escala.value ? '/escalas' : '/calculadoras'))
const rotulo = computed(() => (escala.value ? 'Escala' : 'Calculadora'))

watchEffect(() => {
  const c = calculadora.value
  if (c && route.params.id && route.path.startsWith('/escalas') !== (c.area === 'escala')) {
    router.replace(`${c.area === 'escala' ? '/escalas' : '/calculadoras'}/${c.id}`)
  }
})

function voltar() {
  // Sem histórico (aberta direto pelo link), volta para a lista da área.
  if (window.history.state?.back) router.back()
  else router.push(base.value)
}

async function duplicar() {
  const copia = await calculadoras.duplicar(id.value)
  toast.success(escala.value ? 'Escala duplicada.' : 'Calculadora duplicada.')
  router.push(`${base.value}/${copia.id}/editar`)
}

const confirmarLixeira = ref(false)
async function moverParaLixeira() {
  const nome = calculadora.value?.nome
  const alvo = id.value
  await calculadoras.moverParaLixeira(alvo)
  router.replace(base.value)
  toast(`“${nome}” foi para a lixeira.`, { action: { label: 'Desfazer', onClick: () => calculadoras.restaurar(alvo) } })
}
</script>

<template>
  <section v-if="calculadora" :key="calculadora.id" class="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-4">
    <header class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="bg-card hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full shadow-xs transition-colors"
          aria-label="Voltar"
          @click="voltar"
        >
          <ArrowLeft class="size-5" />
        </button>
        <div class="flex-1" />
        <!-- Pen drive: favorito só exibido -->
        <span v-if="MODO_PENDRIVE && calculadora.favorito" class="flex size-11 items-center justify-center" role="img" aria-label="Favorita">
          <Star class="fill-atencao text-atencao size-6" />
        </span>
        <Button
          v-else-if="!MODO_PENDRIVE"
          variant="ghost"
          size="icon-touch"
          class="rounded-full"
          :aria-label="calculadora.favorito ? 'Remover dos favoritos' : 'Favoritar'"
          :aria-pressed="calculadora.favorito"
          @click="calculadoras.alternarFavorito(id)"
        >
          <Star :class="cn('size-6', calculadora.favorito && 'fill-atencao text-atencao')" />
        </Button>
        <DropdownMenu v-if="!MODO_PENDRIVE && !calculadora.excluidoEm">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="bg-card hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full shadow-xs transition-colors"
              aria-label="Mais ações"
            >
              <Ellipsis class="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-52 rounded-2xl p-1.5">
            <DropdownMenuItem as-child class="h-11 gap-3 rounded-xl px-3 text-sm font-medium">
              <RouterLink :to="`${base}/${id}/editar`"><Pencil class="size-[18px]" /> Editar</RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem class="h-11 gap-3 rounded-xl px-3 text-sm font-medium" @select="duplicar">
              <Copy class="size-[18px]" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" class="h-11 gap-3 rounded-xl px-3 text-sm font-medium" @select="confirmarLixeira = true">
              <Trash2 class="size-[18px]" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h1 class="text-3xl leading-[1.1] font-extrabold tracking-tight break-words md:text-4xl">{{ calculadora.nome }}</h1>

      <div class="flex flex-wrap items-center gap-2">
        <span class="bg-card flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-xs">
          <IconeCategoria :icone="categorias.obter(calculadora.categoriaId)?.icone" class="text-primary" />
          {{ categorias.nome(calculadora.categoriaId) }}
        </span>
      </div>
      <p v-if="calculadora.descricao" class="text-muted-foreground text-sm whitespace-pre-line">{{ calculadora.descricao }}</p>
    </header>

    <div v-if="calculadora.excluidoEm" class="bg-muted rounded-2xl p-3 text-sm">
      {{ escala ? 'Esta escala' : 'Esta calculadora' }} está na lixeira.
    </div>

    <UsoCalculadora :calculadora="calculadora" />

    <div v-if="calculadora.referencia" class="bg-card flex flex-col gap-1.5 rounded-3xl p-4 shadow-xs">
      <h2 class="text-muted-foreground text-xs font-semibold">Referência</h2>
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
    <h1 class="text-2xl font-semibold md:text-3xl">{{ rotulo }} não encontrada</h1>
    <Button size="touch" as-child><RouterLink :to="base">Voltar para a lista</RouterLink></Button>
  </section>
</template>
