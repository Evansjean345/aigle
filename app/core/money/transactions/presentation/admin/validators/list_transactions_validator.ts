import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { minSearchLength } from '#config/app'

/**
 * Filtres et pagination de la liste admin des transactions.
 *
 * `type` et `status` sont ramenés en minuscules avant d'être confrontés à leur énumération : la
 * comparaison de MySQL est insensible à la casse, si bien qu'un `status=PENDING` fonctionnait sans
 * validateur et se serait mis à répondre 422 en en ajoutant un.
 */
const listTransactionsSchema = vine.object({
  page: vine.number().positive().optional(),
  perPage: vine.number().positive().max(100).optional(),
  type: vine
    .enum(Object.values(TransactionType))
    .parse((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    .optional(),
  status: vine
    .enum(Object.values(TransactionStatus))
    .parse((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    .optional(),
  search: vine.string().trim().minLength(minSearchLength).maxLength(100).optional(),
  startDate: vine.string().trim().optional(),
  endDate: vine.string().trim().optional(),
  /** Porteur utilisateur. Conservé pour les transactions antérieures au compte titulaire. */
  userId: vine.string().trim().uuid().optional(),
  /** Compte titulaire. Pour une organisation, l'`organisationId`. */
  accountId: vine.string().trim().uuid().optional(),
})

export const listTransactionsValidator = vine.create(listTransactionsSchema)
export type ListTransactionsValidator = Infer<typeof listTransactionsSchema>

/** Période des compteurs du bandeau. Ni recherche ni filtre de colonne : seules les dates comptent. */
const transactionsStatsSchema = vine.object({
  startDate: vine.string().trim().optional(),
  endDate: vine.string().trim().optional(),
  userId: vine.string().trim().uuid().optional(),
  accountId: vine.string().trim().uuid().optional(),
})

export const transactionsStatsValidator = vine.create(transactionsStatsSchema)
