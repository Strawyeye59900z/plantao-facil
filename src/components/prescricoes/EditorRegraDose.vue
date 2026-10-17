<script setup lang="ts">
import { computed } from 'vue'
import { Calculator, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import ResultadoDose from './ResultadoDose.vue'
import { calcularDose } from '@/dominio/dose/calculo'
import { substituirMarcadores } from '@/dominio/dose/marcadores'
import { ROTULO_DIRECAO } from '@/dominio/dose/numeros'
import { validarRegraDose } from '@/dominio/dose/validarRegra'
import { regraDoseVazia } from '@/dominio/prescricoes/editar'
import {
  SUGESTOES_UNIDADE_DOSE,
  type DirecaoArredondamento,
  type RegraDose,
} from '@/dominio/tipos'

const props = defineProps<{
  /** Prefixo para ids/rótulos, ex.: "item-1" ou "item-1-alt-2". */
  chave: string
  /** Texto do item/alternativa, para a prévia. */
  texto: string
  /** Peso do campo "Testar com peso" (null = sem teste). */
  pesoTeste: number | null
}>()

const regra = defineModel<RegraDose | null>('regra', { required: true })

const id = (campo: string) => `${props.chave}-${campo}`

const opcoesBase = [
  { valor: 'por_tomada' as const, rotulo: 'por kg, por tomada' },
  { valor: 'por_dia' as const, rotulo: 'por kg, por dia (÷ tomadas)' },
]
const opcoesDirecao = (Object.keys(ROTULO_DIRECAO) as DirecaoArredondamento[]).map((d) => ({
  valor: d,
  rotulo: ROTULO_DIRECAO[d],
}))
const opcoesModoDose = [
  { valor: 'inteiro' as const, rotulo: 'Inteiro mais próximo' },
  { valor: 'multiplo' as const, rotulo: 'Múltiplo de…' },
]
const opcoesModoVolume = [
  { valor: 'casas_decimais' as const, rotulo: 'Casas decimais' },
  { valor: 'multiplo' as const, rotulo: 'Múltiplo de…' },
]
const opcoesCasas = [0, 1, 2, 3].map((c) => ({ valor: String(c), rotulo: String(c) }))

/** Campo obrigatório: vazio vira NaN (a validação acusa). */
function obrigatorio(ler: () => number, gravar: (v: number) => void) {
  return computed<number | null>({
    get: ler,
    set: (v) => gravar(v ?? Number.NaN),
  })
}

const dosePorKg = obrigatorio(
  () => regra.value!.dosePorKg,
  (v) => (regra.value!.dosePorKg = v),
)
const acimaDeKg = obrigatorio(
  () => regra.value!.pesoLimite!.acimaDeKg,
  (v) => (regra.value!.pesoLimite!.acimaDeKg = v),
)
const doseFixa = obrigatorio(
  () => regra.value!.pesoLimite!.doseFixa,
  (v) => (regra.value!.pesoLimite!.doseFixa = v),
)
const quantidade = obrigatorio(
  () => regra.value!.concentracao!.quantidade,
  (v) => (regra.value!.concentracao!.quantidade = v),
)
const volumeMl = obrigatorio(
  () => regra.value!.concentracao!.volumeMl,
  (v) => (regra.value!.concentracao!.volumeMl = v),
)
const passoDose = obrigatorio(
  () => (regra.value!.arredondamentoDose.modo === 'multiplo' ? regra.value!.arredondamentoDose.passo : Number.NaN),
  (v) => {
    if (regra.value!.arredondamentoDose.modo === 'multiplo') regra.value!.arredondamentoDose.passo = v
  },
)
const passoVolume = obrigatorio(
  () => (regra.value!.arredondamentoVolume.modo === 'multiplo' ? regra.value!.arredondamentoVolume.passo : Number.NaN),
  (v) => {
    if (regra.value!.arredondamentoVolume.modo === 'multiplo') regra.value!.arredondamentoVolume.passo = v
  },
)

const modoDose = computed({
  get: () => regra.value!.arredondamentoDose.modo,
  set: (modo) => {
    regra.value!.arredondamentoDose =
      modo === 'inteiro' ? { modo } : { modo, passo: Number.NaN, direcao: 'proximo' }
  },
})
const modoVolume = computed({
  get: () => regra.value!.arredondamentoVolume.modo,
  set: (modo) => {
    regra.value!.arredondamentoVolume =
      modo === 'casas_decimais' ? { modo, casas: 1 } : { modo, passo: Number.NaN, direcao: 'proximo' }
  },
})
const casasVolume = computed({
  get: () => (regra.value!.arredondamentoVolume.modo === 'casas_decimais' ? String(regra.value!.arredondamentoVolume.casas) : '1'),
  set: (c: string) => {
    if (regra.value!.arredondamentoVolume.modo === 'casas_decimais') regra.value!.arredondamentoVolume.casas = Number(c)
  },
})

function alternarPesoLimite(ligado: boolean) {
  regra.value!.pesoLimite = ligado ? { acimaDeKg: Number.NaN, doseFixa: Number.NaN } : null
}
function alternarConcentracao(ligado: boolean) {
  regra.value!.concentracao = ligado ? { quantidade: Number.NaN, volumeMl: Number.NaN } : null
}

const unidade = computed(() => regra.value?.unidade.trim() || 'un.')

// Prévia com o peso de teste — só quando a regra está válida.
const errosRegra = computed(() => (regra.value ? validarRegraDose(regra.value) : []))
const previa = computed(() => {
  if (!regra.value || props.pesoTeste === null || errosRegra.value.length) return null
  const resultado = calcularDose(regra.value, props.pesoTeste)
  return { resultado, texto: substituirMarcadores(props.texto, regra.value, resultado) }
})
</script>

<template>
  <Button
    v-if="!regra"
    type="button"
    variant="ghost"
    size="touch"
    class="self-start"
    @click="regra = regraDoseVazia()"
  >
    <Calculator /> Regra de dose
  </Button>

  <div v-else class="border-primary/40 flex flex-col gap-3 rounded-xl border p-3">
    <div class="flex items-center gap-2">
      <Calculator class="text-primary size-4" />
      <span class="flex-1 text-sm font-semibold">Regra de dose</span>
      <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover regra de dose" @click="regra = null">
        <X />
      </Button>
    </div>

    <p class="text-muted-foreground text-xs">
      No texto, use {dose}, {volume}, {dose_diaria} e {tomadas} (vira "de 8h em 8h"). A dose é sempre inteira.
    </p>

    <!-- Dose por kg -->
    <div class="grid grid-cols-2 gap-2">
      <div class="flex flex-col gap-1">
        <Label :for="id('dosekg')">Dose por kg *</Label>
        <CampoNumero :id="id('dosekg')" v-model="dosePorKg" :sufixo="`${unidade}/kg`" />
      </div>
      <div class="flex flex-col gap-1">
        <Label :for="id('unidade')">Unidade *</Label>
        <Input :id="id('unidade')" v-model="regra.unidade" class="h-11" :list="id('sugestoes')" autocomplete="off" />
        <datalist :id="id('sugestoes')">
          <option v-for="u in SUGESTOES_UNIDADE_DOSE" :key="u" :value="u" />
        </datalist>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div class="flex flex-col gap-1">
        <Label :for="id('base')">Base</Label>
        <CampoSelect :id="id('base')" v-model="regra.baseDoseKg" :opcoes="opcoesBase" />
      </div>
      <div class="flex flex-col gap-1">
        <Label :for="id('tomadas')">Tomadas por dia{{ regra.baseDoseKg === 'por_dia' ? ' *' : '' }}</Label>
        <CampoNumero :id="id('tomadas')" v-model="regra.tomadasPorDia" />
      </div>
    </div>

    <!-- Tetos -->
    <div class="grid grid-cols-2 gap-2">
      <div class="flex flex-col gap-1">
        <Label :for="id('maxtomada')">Máx. por tomada</Label>
        <CampoNumero :id="id('maxtomada')" v-model="regra.doseMaximaPorTomada" :sufixo="unidade" />
      </div>
      <div class="flex flex-col gap-1">
        <Label :for="id('maxdia')">Máx. diária</Label>
        <CampoNumero :id="id('maxdia')" v-model="regra.doseMaximaDiaria" :sufixo="unidade" />
      </div>
    </div>

    <!-- Arredondamento da dose -->
    <div class="flex flex-col gap-1">
      <Label :for="id('arrdose')">Arredondamento da dose</Label>
      <CampoSelect :id="id('arrdose')" v-model="modoDose" :opcoes="opcoesModoDose" />
      <div v-if="regra.arredondamentoDose.modo === 'multiplo'" class="grid grid-cols-2 gap-2">
        <CampoNumero v-model="passoDose" :sufixo="unidade" aria-label="Passo do arredondamento da dose" />
        <CampoSelect
          v-model="regra.arredondamentoDose.direcao"
          :opcoes="opcoesDirecao"
          aria-label="Direção do arredondamento da dose"
        />
      </div>
    </div>

    <!-- Peso limite -->
    <div class="flex flex-col gap-2">
      <Label class="flex items-center justify-between gap-3 font-normal">
        Dose fixa acima de um peso
        <Switch :model-value="!!regra.pesoLimite" @update:model-value="alternarPesoLimite" />
      </Label>
      <div v-if="regra.pesoLimite" class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="id('acimade')">Acima de</Label>
          <CampoNumero :id="id('acimade')" v-model="acimaDeKg" sufixo="kg" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="id('dosefixa')">Dose fixa</Label>
          <CampoNumero :id="id('dosefixa')" v-model="doseFixa" :sufixo="unidade" />
        </div>
      </div>
    </div>

    <!-- Concentração / volume -->
    <div class="flex flex-col gap-2">
      <Label class="flex items-center justify-between gap-3 font-normal">
        Converter em volume (concentração)
        <Switch :model-value="!!regra.concentracao" @update:model-value="alternarConcentracao" />
      </Label>
      <template v-if="regra.concentracao">
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <CampoNumero v-model="quantidade" :sufixo="unidade" aria-label="Quantidade da concentração" />
          <span class="text-muted-foreground text-sm">em</span>
          <CampoNumero v-model="volumeMl" sufixo="mL" aria-label="Volume da concentração" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="id('arrvol')">Arredondamento do volume</Label>
          <div class="grid grid-cols-[1fr_5rem] gap-2">
            <CampoSelect :id="id('arrvol')" v-model="modoVolume" :opcoes="opcoesModoVolume" />
            <CampoSelect
              v-if="regra.arredondamentoVolume.modo === 'casas_decimais'"
              v-model="casasVolume"
              :opcoes="opcoesCasas"
              aria-label="Casas decimais do volume"
            />
          </div>
          <div v-if="regra.arredondamentoVolume.modo === 'multiplo'" class="grid grid-cols-2 gap-2">
            <CampoNumero v-model="passoVolume" sufixo="mL" aria-label="Passo do arredondamento do volume" />
            <CampoSelect
              v-model="regra.arredondamentoVolume.direcao"
              :opcoes="opcoesDirecao"
              aria-label="Direção do arredondamento do volume"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- Prévia com o peso de teste -->
    <div v-if="pesoTeste !== null" class="border-t pt-3">
      <p class="mb-1 text-xs font-medium">Teste com {{ String(pesoTeste).replace('.', ',') }} kg</p>
      <template v-if="previa">
        <p class="mb-2 text-sm">{{ previa.texto }}</p>
        <ResultadoDose :resultado="previa.resultado" />
      </template>
      <p v-else class="text-muted-foreground text-sm">Complete a regra para ver o resultado.</p>
    </div>
  </div>
</template>
