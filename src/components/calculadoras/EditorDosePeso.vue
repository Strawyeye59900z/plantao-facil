<script setup lang="ts">
import { nextTick } from 'vue'
import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlert, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoNumeroObrigatorio from '@/components/comum/CampoNumeroObrigatorio.vue'
import {
  linhaDosePesoVazia,
  marcadoresCalculaveis,
  regraDosePesoVazia,
  sincronizarRegras,
} from '@/dominio/calculadoras/editar'
import { moverItem } from '@/dominio/prescricoes/editar'
import type { LinhaDosePeso, RegraDosePeso, UUID } from '@/dominio/tipos'
import UsoDosePeso from './UsoDosePeso.vue'

/**
 * Editor das linhas de uma calculadora de doses por peso. Cada `{marcador}` do texto ganha
 * um cartão de regra; se o marcador sai do texto, a regra preenchida fica (com aviso) até o
 * usuário removê-la.
 */
const linhas = defineModel<LinhaDosePeso[]>({ required: true })

const SUGESTOES_UNIDADE = ['mg', 'mcg', 'g', 'mL', 'UI', 'mEq'] as const

async function focar(idCampo: string) {
  await nextTick()
  const campo = document.getElementById(idCampo)
  campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  campo?.focus({ preventScroll: true })
}

function alterarTexto(linha: LinhaDosePeso, texto: string) {
  linha.regras = sincronizarRegras(texto, linha.texto, linha.regras)
  linha.texto = texto
}

function adicionarLinha() {
  const nova = linhaDosePesoVazia()
  linhas.value.push(nova)
  focar(`linha-${nova.id}`)
}

function mover(i: number, direcao: -1 | 1) {
  linhas.value = moverItem(linhas.value, i, direcao)
}

/** Regras na ordem dos marcadores no texto; as que perderam o marcador vão para o fim. */
function regrasDaLinha(linha: LinhaDosePeso): { regra: RegraDosePeso; usada: boolean }[] {
  const marcadores = marcadoresCalculaveis(linha.texto)
  const posicao = (r: RegraDosePeso) => {
    const p = marcadores.indexOf(r.marcador)
    return p === -1 ? Infinity : p
  }
  return [...linha.regras]
    .sort((a, b) => posicao(a) - posicao(b))
    .map((regra) => ({ regra, usada: marcadores.includes(regra.marcador) }))
}

/** Marcadores sem regra (ex.: dados antigos). */
const semRegra = (linha: LinhaDosePeso) =>
  marcadoresCalculaveis(linha.texto).filter((m) => !linha.regras.some((r) => r.marcador === m))

function criarRegra(linha: LinhaDosePeso, marcador: string) {
  const nova = regraDosePesoVazia(marcador)
  linha.regras.push(nova)
  focar(`regra-${nova.id}-dose`)
}

function removerRegra(linha: LinhaDosePeso, regraId: UUID) {
  linha.regras = linha.regras.filter((r) => r.id !== regraId)
}

/** `{nome}` para exibir no template. */
const chave = (marcador: string) => '{' + marcador + '}'

const BOTAO_ICONE = 'rounded-full'
</script>

<template>
  <section class="bg-card flex flex-col gap-4 rounded-lg p-4 shadow-xs md:p-5" aria-labelledby="titulo-linhas">
    <h2 id="titulo-linhas" class="text-lg font-extrabold tracking-tight">Linhas *</h2>
    <p class="text-muted-foreground -mt-2 text-sm">
      Escreva cada linha como deve aparecer e use <code class="bg-secondary rounded px-1 font-mono">{nome}</code> onde a dose
      deve aparecer (só letras sem acento, números e _). Cada nome ganha uma regra logo abaixo.
    </p>

    <div v-for="(linha, i) in linhas" :key="linha.id" class="border-border flex flex-col gap-3 rounded-2xl border p-3 md:p-4">
      <div class="flex items-center gap-1">
        <span class="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums" aria-hidden="true">
          {{ i + 1 }}
        </span>
        <Label :for="`linha-${linha.id}`" class="ml-1.5 flex-1 font-semibold">Linha {{ i + 1 }}</Label>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :disabled="i === 0"
          :aria-label="`Mover linha ${i + 1} para cima`"
          @click="mover(i, -1)"
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :disabled="i === linhas.length - 1"
          :aria-label="`Mover linha ${i + 1} para baixo`"
          @click="mover(i, 1)"
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :aria-label="`Remover linha ${i + 1}`"
          @click="linhas.splice(i, 1)"
        >
          <Trash2 class="text-destructive" />
        </Button>
      </div>

      <Textarea
        :id="`linha-${linha.id}`"
        :model-value="linha.texto"
        class="min-h-16"
        placeholder="ex.: Medicamento Teste A {dose} EV"
        autocapitalize="off"
        spellcheck="false"
        @update:model-value="(t) => alterarTexto(linha, String(t))"
      />

      <!-- Regras: uma por marcador -->
      <div
        v-for="{ regra, usada } in regrasDaLinha(linha)"
        :key="regra.id"
        class="bg-secondary/50 flex flex-col gap-3 rounded-2xl p-3"
        role="group"
        :aria-label="`Regra ${chave(regra.marcador)} da linha ${i + 1}`"
      >
        <div class="flex items-center gap-2">
          <span class="flex-1 font-mono text-sm font-bold">{{ chave(regra.marcador) }}</span>
          <Button
            v-if="!usada"
            type="button"
            variant="ghost"
            size="icon-touch"
            :class="BOTAO_ICONE"
            :aria-label="`Remover regra ${chave(regra.marcador)} da linha ${i + 1}`"
            @click="removerRegra(linha, regra.id)"
          >
            <X />
          </Button>
        </div>
        <p
          v-if="!usada"
          class="bg-atencao-suave text-atencao-suave-foreground border-atencao/30 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm"
        >
          <TriangleAlert class="text-atencao mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{{ chave(regra.marcador) }} não está mais no texto desta linha. Volte a usá-lo ou remova esta regra.</span>
        </p>
        <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
          <div class="flex flex-col gap-1">
            <Label :for="`regra-${regra.id}-dose`">Dose por kg *</Label>
            <CampoNumeroObrigatorio
              :id="`regra-${regra.id}-dose`"
              v-model="regra.dosePorKg"
              :sufixo="regra.unidade ? `${regra.unidade}/kg` : '/kg'"
            />
          </div>
          <div class="flex flex-col gap-1">
            <Label :for="`regra-${regra.id}-unidade`">Unidade *</Label>
            <Input
              :id="`regra-${regra.id}-unidade`"
              v-model="regra.unidade"
              class="h-11"
              :list="`regra-${regra.id}-sugestoes`"
              autocomplete="off"
              autocapitalize="off"
            />
            <datalist :id="`regra-${regra.id}-sugestoes`">
              <option v-for="u in SUGESTOES_UNIDADE" :key="u" :value="u" />
            </datalist>
          </div>
          <div class="flex flex-col gap-1">
            <Label :for="`regra-${regra.id}-concentracao`">Concentração ({{ regra.unidade || 'un.' }}/mL)</Label>
            <CampoNumero :id="`regra-${regra.id}-concentracao`" v-model="regra.concentracao" />
          </div>
          <div class="flex flex-col gap-1">
            <Label :for="`regra-${regra.id}-maxima`">Dose máxima</Label>
            <CampoNumero
              :id="`regra-${regra.id}-maxima`"
              v-model="regra.doseMaxima"
              :sufixo="regra.unidade"
            />
          </div>
          <div class="flex flex-col gap-1">
            <Label :for="`regra-${regra.id}-casas`">Casas decimais</Label>
            <CampoNumeroObrigatorio :id="`regra-${regra.id}-casas`" v-model="regra.casasDecimais" />
          </div>
        </div>
      </div>

      <div v-for="marcador in semRegra(linha)" :key="`sem-${marcador}`" class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted-foreground"><code class="font-mono">{{ chave(marcador) }}</code> está sem regra.</span>
        <Button type="button" variant="outline" size="touch" class="rounded-full" @click="criarRegra(linha, marcador)">
          <Plus /> Criar regra
        </Button>
      </div>
    </div>

    <p v-if="!linhas.length" class="text-muted-foreground text-sm">Nenhuma linha. Inclua pelo menos 1.</p>
    <Button type="button" variant="outline" size="touch" class="self-start rounded-full" @click="adicionarLinha">
      <Plus /> Adicionar linha
    </Button>
  </section>

  <section class="bg-card flex flex-col gap-4 rounded-lg p-4 shadow-xs md:p-5" aria-labelledby="titulo-testar">
    <h2 id="titulo-testar" class="text-lg font-extrabold tracking-tight">Testar com peso</h2>
    <p class="text-muted-foreground -mt-2 text-sm">Confira as linhas com um peso de teste. Nada daqui é salvo.</p>
    <div class="bg-background rounded-2xl p-3 md:p-4">
      <UsoDosePeso :calculadora="{ linhas }" />
    </div>
  </section>
</template>
