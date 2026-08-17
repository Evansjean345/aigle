import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'
import { LedgerDirection, LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import { ledgerSortNames } from '#core/money/ledger/domain/types/ledger_sorts'
import { minSearchLength } from '#config/app'

/** Périodes que le dépôt sait traduire en date de départ. Toute autre valeur ne filtre rien. */
export const ledgerStatsPeriods = ['7d', '30d', '90d'] as const

/**
 * Filtres et pagination de la liste admin des écritures comptables.
 *
 * `direction` est stockée en majuscules, `operationType` en minuscules : chacune est normalisée
 * avant d'être confrontée à son énumération, pour qu'une casse inattendue ne devienne pas un 422.
 */
const listLedgersSchema = vine.object({
  page: vine.number().positive().optional(),
  perPage: vine.number().positive().max(100).optional(),
  walletId: vine.number().positive().optional(),
  direction: vine
    .string()
    .trim()
    .parse((value) => (typeof value === 'string' ? value.toUpperCase() : value))
    .in(Object.values(LedgerDirection))
    .optional(),
  operationType: vine
    .string()
    .trim()
    .parse((value) => (typeof value === 'string' ? value.toLowerCase() : value))
    .in(Object.values(LedgerOperationType))
    .optional(),
  search: vine.string().trim().minLength(minSearchLength).maxLength(100).optional(),
  sortBy: vine.enum(ledgerSortNames).optional(),
  order: vine.enum(['asc', 'desc']).optional(),
  startDate: vine.string().trim().optional(),
  endDate: vine.string().trim().optional(),
  /** Porteur utilisateur. Conservé pour les écritures antérieures au compte titulaire. */
  userId: vine.string().trim().uuid().optional(),
  /** Compte titulaire. Pour une organisation, l'`organisationId`. */
  accountId: vine.string().trim().uuid().optional(),
})

export const listLedgersValidator = vine.create(listLedgersSchema)
export type ListLedgersValidator = Infer<typeof listLedgersSchema>

/** Période des compteurs du grand livre. Sans `period`, aucune borne de départ n'est posée. */
const ledgersStatsSchema = vine.object({
  walletId: vine.number().positive().optional(),
  accountId: vine.string().trim().uuid().optional(),
  period: vine.enum(ledgerStatsPeriods).optional(),
  startDate: vine.string().trim().optional(),
  endDate: vine.string().trim().optional(),
})

export const ledgersStatsValidator = vine.create(ledgersStatsSchema)
