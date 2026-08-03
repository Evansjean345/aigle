import vine from '@vinejs/vine'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'

/**
 * Validateurs de la déclaration de versement par le marchand.
 *
 * Le justificatif est obligatoire : le versement précède la déclaration, le marchand a donc son reçu
 * au moment de remplir le formulaire.
 */
export const declareFundingRequestValidator = vine.create(
  vine.object({
    collectionAccountReference: vine.string().trim().minLength(1),
    // Entier : le XOF n'a pas de subdivision.
    declaredAmount: vine.number().positive().withoutDecimals(),
    document: vine.file({
      size: '10mb',
      extnames: ['jpg', 'jpeg', 'png', 'pdf'],
    }),
  })
)

/** Filtre de liste. Sans statut, toutes les demandes de l'organisation sont renvoyées. */
export const listFundingRequestsValidator = vine.create(
  vine.object({
    status: vine.enum(Object.values(FundingRequestStatus)).optional(),
  })
)
