import vine from '@vinejs/vine'
import { userSortNames } from '#core/identity/user/domain/types/user_sorts'
import { minSearchLength } from '#config/app'

/**
 * Filtres de la liste des utilisateurs.
 *
 * `sortBy` n'accepte que les noms déclarés par la table de tri : un nom de colonne ne peut pas
 * transiter jusqu'à la requête.
 */
export const listUsersValidator = vine.create(
  vine.object({
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(100).optional(),
    search: vine.string().trim().minLength(minSearchLength).optional(),
    sortBy: vine.enum(userSortNames).optional(),
    order: vine.enum(['asc', 'desc'] as const).optional(),
    startDate: vine.string().trim().minLength(1).optional(),
    endDate: vine.string().trim().minLength(1).optional(),
  })
)
