<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, CircleCheck, ClipboardCopy, Copy, Ellipsis, Pencil, Star, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import AlertasPrescricao from '@/components/prescricoes/AlertasPrescricao.vue'
import CartaoCalculadoraLigada from '@/components/prescricoes/CartaoCalculadoraLigada.vue'
import CaixaObservacoes from '@/components/prescricoes/CaixaObservacoes.vue'
import CartaoReceita from '@/components/prescricoes/CartaoReceita.vue'
import ListaItens from '@/components/prescricoes/ListaItens.vue'
import SeletorCondicoes from '@/components/prescricoes/SeletorCondicoes.vue'
import { ETIQUETA_REVISAR } from '@/components/biblioteca/etiquetas'
import { alertasDaPrescricao } from '@/dominio/prescricoes/alertas'
import type { CondicoesMarcadas } from '@/dominio/prescricoes/condicoes'
import { itensVisiveis, montarCopiaPrescricao, type EscolhasOu } from '@/dominio/prescricoes/copia'
import type { Calculadora, UUID } from '@/dominio/tipos'
import { copiarTexto } from '@/lib/areaTransferencia'
import { cn } from '@/lib/utils'
import { MODO_PENDRIVE } from '@/modo'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

const route = useRoute()
const router = useRouter()
const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()
const calculadoras = useCalculadorasStore()

const id = computed(() => String(route.params.id))
const prescricao = computed(() => prescricoes.obter(id.value))

// Estado só desta tela (a view é recriada a cada rota, então volta ao padrão ao sair):
// nenhuma condição marcada e nenhuma opção "OU" escolhida.
const marcadas = ref<CondicoesMarcadas>({})
const escolhas = ref<EscolhasOu>({})
/** Item "OU" destacado depois de um Copiar sem escolha. */
const destacado = ref<UUID | null>(null)

const itens = computed(() => (prescricao.value ? itensVisiveis(prescricao.value, marcadas.value) : []))
const copia = computed(() =>
  prescricao.value ? montarCopiaPrescricao(prescricao.value, marcadas.value, escolhas.value) : null,
)

/** Alertas da prescrição ou condições: ficam acima da lista (no PC, só na coluna principal). */
const alertasTopo = computed(() => (prescricao.value ? alertasDaPrescricao(prescricao.value) : []))
const temTopo = computed(() => alertasTopo.value.length > 0 || (prescricao.value?.condicoes.length ?? 0) > 0)
const temReceita = computed(() => (prescricao.value?.receita.trim() ?? '') !== '')
/** Calculadoras e escalas ligadas, na ordem do editor; as da lixeira (ou que sumiram) não aparecem, mas o vínculo fica. */
const ligadas = computed(() =>
  (prescricao.value?.calculadoraIds ?? [])
    .map((cid) => calculadoras.obter(cid))
    .filter((c): c is Calculadora => !!c && c.excluidoEm === null),
)

// ===== Abas =====
// PC: Prescrição | Calculadoras · N (a receita fica na coluna da direita).
// Celular: Prescrição | Receita | Calculadoras · N.
type Aba = 'prescricao' | 'receita' | 'calculadoras'
const aba = ref<Aba>('prescricao')
/** A barra de abas só aparece se houver mais de uma aba (no PC, a receita não conta). */
const classeAbas = computed(() =>
  ligadas.value.length > 0 ? 'flex' : temReceita.value ? 'flex md:hidden' : 'hidden',
)
const ESTILO_ABA = 'flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-xs transition-colors'
function classeAba(alvo: Aba) {
  return cn(
    ESTILO_ABA,
    aba.value === alvo ? 'bg-foreground text-background' : 'bg-card hover:bg-accent',
    // No PC, "Receita" não existe como aba: com ela escolhida no celular, Prescrição aparece ativa.
    alvo === 'prescricao' && aba.value === 'receita' && 'md:bg-foreground md:text-background',
    alvo === 'receita' && 'md:hidden',
  )
}
// Coluna principal: aba Prescrição (e, no PC, também com "Receita" escolhida no celular).
const classePrincipal = computed(() =>
  aba.value === 'prescricao' ? '' : aba.value === 'receita' ? 'hidden md:flex' : 'hidden',
)
// Receita: aba própria no celular; coluna da direita no PC.
const classeReceita = computed(() =>
  aba.value === 'receita' ? '' : aba.value === 'prescricao' ? 'hidden md:block' : 'hidden',
)

// ===== Copiar =====
async function copiarPrescricao() {
  const resultado = copia.value
  if (!resultado) return
  if (!resultado.ok) {
    toast.error(resultado.erro)
    const falta = itens.value.find((i) => i.opcoes.length >= 2 && !i.opcoes.some((o) => o.id === escolhas.value[i.id]))
    destacado.value = falta?.id ?? null
    if (falta) {
      await nextTick()
      const el = document.getElementById(`item-${falta.id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector<HTMLInputElement>('input[type=radio]')?.focus({ preventScroll: true })
    }
    return
  }
  destacado.value = null
  try {
    await copiarTexto(resultado.texto)
    toast.success('Prescrição copiada.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}

// ===== Ações =====
function voltar() {
  // Sem histórico (aberta direto pelo link), volta para a lista.
  if (window.history.state?.back) router.back()
  else router.push('/prescricoes')
}

async function favoritar() {
  await prescricoes.alternarFavorito(id.value)
}

async function marcarRevisada() {
  await prescricoes.atualizar(id.value, { revisada: true })
  toast.success('Marcada como revisada.')
}

async function duplicar() {
  const nova = await prescricoes.duplicar(id.value)
  toast.success('Prescrição duplicada.')
  router.push(`/prescricoes/${nova.id}/editar`)
}

const confirmarLixeira = ref(false)
async function moverParaLixeira() {
  const titulo = prescricao.value?.titulo
  const alvo = id.value
  await prescricoes.moverParaLixeira(alvo)
  router.replace('/prescricoes')
  toast(`“${titulo}” foi para a lixeira.`, {
    action: { label: 'Desfazer', onClick: () => prescricoes.restaurar(alvo) },
  })
}
</script>

<template>
  <section v-if="prescricao" :class="cn('mx-auto flex w-full flex-col gap-5', !temReceita && 'max-w-3xl')">
    <!-- Cabeçalho -->
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
        <!-- Pen drive: favorito só exibido (a próxima atualização da biblioteca apagaria a mudança) -->
        <span
          v-if="MODO_PENDRIVE && prescricao.favorito"
          class="flex size-11 items-center justify-center"
          role="img"
          aria-label="Favorita"
        >
          <Star class="fill-atencao text-atencao size-6" />
        </span>
        <Button
          v-else-if="!MODO_PENDRIVE"
          variant="ghost"
          size="icon-touch"
          class="rounded-full"
          :aria-label="prescricao.favorito ? 'Remover dos favoritos' : 'Favoritar'"
          :aria-pressed="prescricao.favorito"
          @click="favoritar"
        >
          <Star :class="cn('size-6', prescricao.favorito && 'fill-atencao text-atencao')" />
        </Button>
        <DropdownMenu v-if="!MODO_PENDRIVE && !prescricao.excluidoEm">
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
              <RouterLink :to="`/prescricoes/${prescricao.id}/editar`"><Pencil class="size-[18px]" /> Editar</RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem class="h-11 gap-3 rounded-xl px-3 text-sm font-medium" @select="duplicar">
              <Copy class="size-[18px]" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              class="h-11 gap-3 rounded-xl px-3 text-sm font-medium"
              @select="confirmarLixeira = true"
            >
              <Trash2 class="size-[18px]" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h1 class="text-3xl leading-[1.1] font-extrabold tracking-tight break-words md:text-4xl">{{ prescricao.titulo }}</h1>

      <div class="flex flex-col gap-3 md:flex-row md:items-start">
        <div class="flex min-w-0 flex-wrap items-center gap-2 md:flex-1">
          <span class="bg-card flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-xs">
            <IconeCategoria :icone="categorias.obter(prescricao.categoriaId)?.icone" class="text-primary" />
            {{ categorias.nome(prescricao.categoriaId) }}
          </span>
          <template v-if="!prescricao.revisada">
            <span class="bg-atencao-suave text-atencao-suave-foreground flex h-8 items-center rounded-full px-3 text-xs font-semibold">
              {{ ETIQUETA_REVISAR }}
            </span>
            <Button
              v-if="!MODO_PENDRIVE && !prescricao.excluidoEm"
              variant="outline"
              size="touch"
              class="rounded-full text-sm"
              @click="marcarRevisada"
            >
              <CircleCheck /> Marcar como revisada
            </Button>
            <ul
              v-if="prescricao.duvidasImportacao.length"
              class="bg-atencao-suave text-atencao-suave-foreground basis-full list-disc rounded-2xl py-3 pr-4 pl-8 text-sm"
              aria-label="Dúvidas da importação"
            >
              <li v-for="(duvida, i) in prescricao.duvidasImportacao" :key="i">{{ duvida }}</li>
            </ul>
          </template>
        </div>

        <nav :class="cn('-m-1 gap-1.5 overflow-x-auto p-1 md:ml-auto', classeAbas)" role="tablist" aria-label="Seções da prescrição">
          <button type="button" role="tab" :aria-selected="aba === 'prescricao'" :class="classeAba('prescricao')" @click="aba = 'prescricao'">
            Prescrição
          </button>
          <button
            v-if="temReceita"
            type="button"
            role="tab"
            :aria-selected="aba === 'receita'"
            :class="classeAba('receita')"
            @click="aba = 'receita'"
          >
            Receita
          </button>
          <button
            v-if="ligadas.length"
            type="button"
            role="tab"
            :aria-selected="aba === 'calculadoras'"
            :class="classeAba('calculadoras')"
            @click="aba = 'calculadoras'"
          >
            Calculadoras · {{ ligadas.length }}
          </button>
        </nav>
      </div>

      <p v-if="prescricao.excluidoEm" class="bg-muted rounded-2xl p-3 text-sm">Esta prescrição está na lixeira.</p>
    </header>

    <!-- Aba Calculadoras: um cartão recolhível por item; o primeiro já vem aberto -->
    <section v-if="aba === 'calculadoras'" class="flex flex-col gap-3" aria-label="Calculadoras e escalas">
      <CartaoCalculadoraLigada v-for="(calc, i) in ligadas" :key="calc.id" :calculadora="calc" :aberta="i === 0" />
    </section>

    <!--
      PC (md+): grade 1.55fr | 1fr. Linha 1: alertas e condições (só na coluna principal);
      linha 2: lista + observações à esquerda e a receita à direita, alinhada ao topo da lista.
    -->
    <div v-else :class="cn('flex flex-col gap-4', temReceita && 'md:grid md:grid-cols-[1.55fr_1fr] md:items-start')">
      <div
        v-if="temTopo"
        :class="cn('flex flex-col gap-4 md:col-start-1', classePrincipal)"
      >
        <AlertasPrescricao :alertas="alertasTopo" />
        <SeletorCondicoes v-model="marcadas" :condicoes="prescricao.condicoes" />
      </div>

      <div :class="cn('flex flex-col gap-4 md:col-start-1', classePrincipal)">
        <div class="bg-card flex flex-col gap-4 rounded-lg p-4 shadow-xs md:p-5">
          <ListaItens
            v-if="itens.length"
            v-model:escolhas="escolhas"
            :itens="itens"
            :condicoes="prescricao.condicoes"
            :alertas="prescricao.alertas"
            :destacado="destacado"
          />
          <p v-else class="text-muted-foreground py-2 text-[15px]">
            {{ prescricao.itens.length ? 'Marque uma condição acima para ver os itens.' : 'Nenhum item cadastrado.' }}
          </p>

          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button size="touch" class="rounded-full font-semibold" @click="copiarPrescricao">
              <ClipboardCopy /> Copiar prescrição
            </Button>
            <p v-if="copia && !copia.ok" class="text-muted-foreground text-sm" aria-live="polite">{{ copia.erro }}</p>
          </div>
        </div>

        <CaixaObservacoes :texto="prescricao.observacoes" />

        <div v-if="prescricao.referencia.trim()" class="text-muted-foreground flex flex-col gap-0.5 px-1 text-xs">
          <h2 class="font-semibold">Referência</h2>
          <p class="whitespace-pre-line">{{ prescricao.referencia }}</p>
        </div>
      </div>

      <div
        v-if="temReceita"
        :class="cn(
          'md:col-start-2',
          temTopo ? 'md:row-start-2' : 'md:row-start-1',
          classeReceita,
        )"
      >
        <CartaoReceita :receita="prescricao.receita" />
      </div>
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
    <h1 class="text-2xl font-semibold md:text-3xl">Prescrição não encontrada</h1>
    <Button size="touch" as-child><RouterLink to="/prescricoes">Voltar para a lista</RouterLink></Button>
  </section>
</template>
