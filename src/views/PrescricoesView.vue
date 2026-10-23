<script setup lang="ts">
import PainelBiblioteca from '@/components/biblioteca/PainelBiblioteca.vue'
import { ETIQUETA_REVISAR } from '@/components/biblioteca/etiquetas'
import { filtrarPrescricoes } from '@/dominio/prescricoes/busca'
import type { Prescricao } from '@/dominio/tipos'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'
import { toast } from 'vue-sonner'

const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()

function filtrar(itens: Prescricao[], termo: string) {
  return filtrarPrescricoes(itens, termo, (id) => categorias.obter(id)?.nome ?? '')
}

const plural = (n: number) => `${n} ${n === 1 ? 'prescrição' : 'prescrições'}`

async function excluirVarias(ids: string[]) {
  try {
    const n = await prescricoes.moverVariasParaLixeira(ids)
    toast.success(`${plural(n)} na Lixeira.`)
  } catch (erro) {
    toast.error(`Não foi possível excluir: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}

async function excluirGrupo(grupoId: string) {
  try {
    const n = await categorias.excluirComPrescricoes(grupoId)
    toast.success(n > 0 ? `Grupo excluído e ${plural(n)} na Lixeira.` : 'Grupo excluído.')
  } catch (erro) {
    toast.error(`Não foi possível excluir o grupo: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}

function descrever(p: Prescricao) {
  const etiquetas: string[] = []
  const n = p.condicoes.length
  if (n > 0) etiquetas.push(`${n} ${n === 1 ? 'condição' : 'condições'}`)
  if (p.revisada === false) etiquetas.push(ETIQUETA_REVISAR)
  return { etiquetas, meta: p.receita.trim() ? 'Receita de alta' : '' }
}
</script>

<template>
  <PainelBiblioteca
    rota-base="/prescricoes"
    rotulo-novo="Nova prescrição"
    texto-vazio="Nenhuma prescrição cadastrada."
    :nome-itens="{ um: 'prescrição', varios: 'prescrições' }"
    :itens="prescricoes.ativas"
    :grupos="categorias.dePrescricoes"
    :filtrar="filtrar"
    :descrever="descrever"
    selecionavel
    @excluir-varias="excluirVarias"
    @excluir-grupo="excluirGrupo"
  />
</template>
