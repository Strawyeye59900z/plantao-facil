<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { adicionarAnotacao, adicionarLeito, adicionarProblema, adicionarSuspeita, removerProblema } from '@/dominio/anamnese/bloco'
import { celular, conectarCelular, desconectarCelular, garantirCodigoPc, pc, sincronizarCelular } from '@/lib/anamnese/estado'

/** Bloco de notas beira leito. No celular: editar e sincronizar. No PC: ver o código e o bloco recebido. */
const ehCelular = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
const gerarId = () => crypto.randomUUID()
const agora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// ----- celular -----
const codigoDigitado = ref('')
const novoLeito = ref('')
const leitoId = ref<string | null>(null)
const novoProblema = ref('')
const suspeitaPorProblema = ref<Record<string, string>>({})
const anotacao = ref('')
const leitoAtual = computed(() => celular.bloco.value.leitos.find((l) => l.id === leitoId.value) ?? null)

function criarLeito() {
  const antes = celular.bloco.value.leitos.length
  celular.bloco.value = adicionarLeito(celular.bloco.value, novoLeito.value, gerarId)
  if (celular.bloco.value.leitos.length > antes) {
    leitoId.value = celular.bloco.value.leitos[celular.bloco.value.leitos.length - 1]!.id
    novoLeito.value = ''
  }
}
function criarProblema() {
  if (!leitoAtual.value) return
  celular.bloco.value = adicionarProblema(celular.bloco.value, leitoAtual.value.id, novoProblema.value, gerarId)
  novoProblema.value = ''
}
function criarSuspeita(problemaId: string) {
  if (!leitoAtual.value) return
  celular.bloco.value = adicionarSuspeita(celular.bloco.value, leitoAtual.value.id, problemaId, suspeitaPorProblema.value[problemaId] ?? '', gerarId)
  suspeitaPorProblema.value[problemaId] = ''
}
function apagarProblema(problemaId: string) {
  if (!leitoAtual.value) return
  celular.bloco.value = removerProblema(celular.bloco.value, leitoAtual.value.id, problemaId)
}
function criarAnotacao() {
  if (!leitoAtual.value) return
  celular.bloco.value = adicionarAnotacao(celular.bloco.value, leitoAtual.value.id, anotacao.value, agora(), gerarId)
  anotacao.value = ''
}

// ----- PC -----
const leitoPcId = ref<string | null>(null)
const leitoPc = computed(() => pc.bloco.value?.leitos.find((l) => l.id === leitoPcId.value) ?? null)
const copiado = ref(false)

function textoDoLeito(): string {
  const l = leitoPc.value
  if (!l) return ''
  const problemas = l.problemas.map((p, i) => [`${i + 1}. ${p.titulo}`, ...p.suspeitas.map((s, j) => `   ${String.fromCharCode(97 + j)}) ${s.texto}`)].join('\n'))
  const anotacoes = l.anotacoes.map((a) => `${a.hora} ${a.texto}`).join('\n')
  return `${l.identificacao}\n\nPROBLEMAS\n${problemas.join('\n') || 'Nenhum'}\n\nANOTAÇÕES\n${anotacoes || 'Nenhuma'}`
}
async function copiarLeito() {
  await navigator.clipboard.writeText(textoDoLeito())
  copiado.value = true
  setTimeout(() => (copiado.value = false), 2000)
}

onMounted(() => {
  if (!ehCelular) void garantirCodigoPc()
})
</script>

<template>
  <main class="mx-auto flex max-w-5xl flex-col gap-4 p-4">
    <header>
      <h1 class="text-2xl font-bold">Bloco de notas</h1>
    </header>

    <!-- CELULAR -->
    <template v-if="ehCelular">
      <section aria-labelledby="titulo-conexao" class="rounded-2xl border bg-card p-4">
        <h2 id="titulo-conexao" class="mb-2 text-sm font-semibold">Sincronização com o PC</h2>
        <div v-if="!celular.conectado.value" class="flex gap-2">
          <input
            v-model="codigoDigitado"
            class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base uppercase"
            aria-label="Código do PC"
            placeholder="Código de 8 letras e números"
            autocomplete="off"
            spellcheck="false"
          />
          <Button size="touch" :disabled="!codigoDigitado.trim()" @click="conectarCelular(codigoDigitado)">Conectar</Button>
        </div>
        <div v-else class="flex flex-wrap items-center gap-2">
          <Button size="touch" @click="sincronizarCelular">Sincronizar com o PC</Button>
          <Button size="touch" variant="outline" @click="desconectarCelular">Desconectar</Button>
        </div>
        <p v-if="celular.aviso.value" class="text-muted-foreground mt-2 text-sm" role="status">{{ celular.aviso.value }}</p>
        <p v-if="celular.erro.value" class="text-critico mt-2 text-sm" role="alert">{{ celular.erro.value }}</p>
      </section>

      <section aria-labelledby="titulo-leito" class="rounded-2xl border bg-card p-4">
        <h2 id="titulo-leito" class="mb-2 text-sm font-semibold">Leito</h2>
        <div class="mb-3 flex flex-wrap gap-2">
          <button
            v-for="l in celular.bloco.value.leitos"
            :key="l.id"
            type="button"
            class="min-h-11 rounded-full border px-4 text-sm"
            :class="l.id === leitoId ? 'border-primary bg-accent font-semibold' : 'bg-background'"
            :aria-pressed="l.id === leitoId"
            @click="leitoId = l.id"
          >
            {{ l.identificacao }}
          </button>
        </div>
        <div class="flex gap-2">
          <input v-model="novoLeito" class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base" aria-label="Identificação do novo leito" placeholder="Ex.: Leito 12" spellcheck="false" />
          <Button size="touch" variant="outline" :disabled="!novoLeito.trim()" @click="criarLeito">Adicionar leito</Button>
        </div>
      </section>

      <div v-if="leitoAtual" class="flex flex-col gap-4">
        <section aria-labelledby="titulo-problemas" class="rounded-2xl border bg-card p-4">
          <h2 id="titulo-problemas" class="mb-2 text-sm font-semibold">Problemas e suspeitas</h2>
          <ol class="flex list-decimal flex-col gap-3 pl-5">
            <li v-for="p in leitoAtual.problemas" :key="p.id">
              <div class="flex items-start justify-between gap-2">
                <span class="font-semibold">{{ p.titulo }}</span>
                <button type="button" class="min-h-11 text-sm text-critico" @click="apagarProblema(p.id)">Remover</button>
              </div>
              <ol class="mt-1 list-[lower-alpha] pl-5 text-sm">
                <li v-for="s in p.suspeitas" :key="s.id">{{ s.texto }}</li>
              </ol>
              <div class="mt-2 flex gap-2">
                <input v-model="suspeitaPorProblema[p.id]" class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base" :aria-label="`Suspeita para ${p.titulo}`" placeholder="Suspeita diagnóstica" spellcheck="false" />
                <Button size="touch" variant="outline" @click="criarSuspeita(p.id)">Incluir</Button>
              </div>
            </li>
          </ol>
          <div class="mt-3 flex gap-2">
            <input v-model="novoProblema" class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base" aria-label="Novo problema" placeholder="Novo problema" spellcheck="false" />
            <Button size="touch" variant="outline" :disabled="!novoProblema.trim()" @click="criarProblema">Incluir</Button>
          </div>
        </section>

        <section aria-labelledby="titulo-anotacoes" class="rounded-2xl border bg-card p-4">
          <h2 id="titulo-anotacoes" class="mb-2 text-sm font-semibold">Anotações</h2>
          <ul class="mb-3 flex flex-col gap-2">
            <li v-for="a in leitoAtual.anotacoes" :key="a.id" class="rounded-xl bg-background p-3 text-sm">
              <span class="text-muted-foreground">{{ a.hora }}</span> · {{ a.texto }}
            </li>
          </ul>
          <textarea v-model="anotacao" rows="3" class="border-input w-full rounded-xl border p-3 text-base" aria-label="Nova anotação" placeholder="Dite ou escreva a anotação" spellcheck="false" />
          <Button size="touch" class="mt-2" :disabled="!anotacao.trim()" @click="criarAnotacao">Adicionar anotação</Button>
        </section>
      </div>
    </template>

    <!-- PC -->
    <template v-else>
      <section aria-labelledby="titulo-codigo" class="rounded-2xl border bg-card p-4">
        <h2 id="titulo-codigo" class="mb-2 text-sm font-semibold">Código para o celular</h2>
        <p v-if="pc.codigo.value" class="font-mono text-3xl font-bold tracking-widest" aria-label="Código de sincronização">{{ pc.codigo.value }}</p>
        <p class="text-muted-foreground mt-1 text-sm">{{ pc.status.value }}</p>
        <Button size="touch" variant="outline" class="mt-3" @click="garantirCodigoPc">Gerar novo código</Button>
        <p v-if="pc.erro.value" class="text-critico mt-2 text-sm" role="alert">{{ pc.erro.value }}</p>
      </section>

      <div class="grid gap-4 md:grid-cols-[14rem_1fr]">
        <aside aria-label="Leitos recebidos" class="flex flex-col gap-2">
          <p v-if="!pc.bloco.value?.leitos.length" class="text-muted-foreground text-sm">Nenhum leito recebido.</p>
          <button
            v-for="l in pc.bloco.value?.leitos ?? []"
            :key="l.id"
            type="button"
            class="min-h-11 rounded-xl border px-3 py-2 text-left text-sm"
            :class="l.id === leitoPcId ? 'border-primary bg-accent font-semibold' : 'bg-card'"
            :aria-pressed="l.id === leitoPcId"
            @click="leitoPcId = l.id"
          >
            {{ l.identificacao }}
          </button>
        </aside>

        <section v-if="leitoPc" class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xl font-bold">{{ leitoPc.identificacao }}</h2>
            <Button size="touch" variant="outline" @click="copiarLeito">{{ copiado ? 'Copiado' : 'Copiar leito' }}</Button>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <section class="rounded-2xl border bg-card p-4">
              <h3 class="mb-2 text-sm font-semibold">Anotações</h3>
              <p v-if="!leitoPc.anotacoes.length" class="text-muted-foreground text-sm">Nenhuma anotação.</p>
              <ul class="flex flex-col gap-2">
                <li v-for="a in leitoPc.anotacoes" :key="a.id" class="text-sm"><span class="text-muted-foreground">{{ a.hora }}</span> · {{ a.texto }}</li>
              </ul>
            </section>
            <section class="rounded-2xl border bg-card p-4">
              <h3 class="mb-2 text-sm font-semibold">Problemas e suspeitas</h3>
              <p v-if="!leitoPc.problemas.length" class="text-muted-foreground text-sm">Nenhum problema cadastrado.</p>
              <ol class="flex list-decimal flex-col gap-3 pl-5">
                <li v-for="p in leitoPc.problemas" :key="p.id">
                  <span class="font-semibold">{{ p.titulo }}</span>
                  <ol v-if="p.suspeitas.length" class="mt-1 list-[lower-alpha] pl-5 text-sm">
                    <li v-for="s in p.suspeitas" :key="s.id">{{ s.texto }}</li>
                  </ol>
                </li>
              </ol>
            </section>
          </div>
        </section>
        <section v-else class="rounded-2xl border border-dashed bg-card p-6 text-muted-foreground">Escolha um leito na lista.</section>
      </div>
    </template>
  </main>
</template>
