import vine from '@vinejs/vine'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'

/**
 * Validateurs de la revue des demandes de réapprovisionnement par le back-office.
 */

export const approveFundingRequestValidator = vine.create(
  vine.object({
    /**
     * Montant constaté sur le justificatif.
     *
     * Le plafonnement au montant déclaré est appliqué par le service, qui lit la demande sous
     * verrou.
     */
    verifiedAmount: vine.number().positive().withoutDecimals(),
    // Obligatoire : le commentaire atteste de ce que le gestionnaire a vérifié sur la pièce.
    comment: vine.string().trim().minLength(3).maxLength(500),
  })
)

export const rejectFundingRequestValidator = vine.create(
  vine.object({
    comment: vine.string().trim().minLength(3).maxLength(500),
  })
)

export const listFundingRequestsForReviewValidator = vine.create(
  vine.object({
    status: vine.enum(Object.values(FundingRequestStatus)).optional(),
    /** Restreint la file aux demandes d'une organisation, pour l'onglet de sa fiche. */
    organisationId: vine.string().trim().minLength(1).optional(),
  })
)

/** Valide la confirmation par un second gestionnaire. Ne porte pas de montant. */
export const confirmFundingRequestValidator = vine.create(
  vine.object({
    comment: vine.string().trim().minLength(3).maxLength(500),
  })
)

/** Valide la mise à jour du seuil de double validation. */
export const updateFundingSettingsValidator = vine.create(
  vine.object({
    // Entier positif : le XOF n'a pas de subdivision. Zéro est autorisé et signifie que toute
    // demande exige deux valideurs.
    doubleApprovalThreshold: vine.number().min(0).withoutDecimals(),
  })
)
