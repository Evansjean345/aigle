import vine from '@vinejs/vine'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'

/** Décisions qu'un gestionnaire peut appliquer à un dossier. */
const DECISIONS = [KycDocumentStatus.APPROVED, KycDocumentStatus.REJECTED]

/**
 * Décision de revue sur un dossier d'entreprise.
 *
 * Le motif est obligatoire pour un refus : l'entreprise doit savoir quelle pièce reprendre.
 */
export const processKybFileValidator = vine.create(
  vine.object({
    status: vine.enum(DECISIONS),
    comment: vine
      .string()
      .trim()
      .minLength(1)
      .optional()
      .requiredWhen('status', '=', KycDocumentStatus.REJECTED),
  })
)

/** Filtres de la file de revue. */
export const listKybFilesValidator = vine.create(
  vine.object({
    status: vine.enum(Object.values(KycDocumentStatus)).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().optional(),
  })
)
