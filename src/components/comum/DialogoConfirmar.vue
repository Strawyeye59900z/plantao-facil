<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

withDefaults(
  defineProps<{
    titulo: string
    descricao?: string
    rotuloConfirmar?: string
    perigoso?: boolean
  }>(),
  { rotuloConfirmar: 'Confirmar' },
)

const aberto = defineModel<boolean>('aberto', { required: true })
const emit = defineEmits<{ confirmar: []; cancelar: [] }>()

// Emite antes de fechar: quem usa o diálogo pode limpar o estado ao fechar.
function confirmar() {
  emit('confirmar')
  aberto.value = false
}
</script>

<template>
  <AlertDialog v-model:open="aberto">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ titulo }}</AlertDialogTitle>
        <AlertDialogDescription v-if="descricao">{{ descricao }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel size="touch" @click="emit('cancelar')">Cancelar</AlertDialogCancel>
        <Button size="touch" :variant="perigoso ? 'destructive' : 'default'" @click="confirmar">
          {{ rotuloConfirmar }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
