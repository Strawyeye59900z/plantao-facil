import { db } from '@/db/banco'
import { criarRepositorio } from './repositorioBase'

export const repoPrescricoes = criarRepositorio(db.prescricoes)
export const repoCategorias = criarRepositorio(db.categorias)
