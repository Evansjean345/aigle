import vine from '@vinejs/vine'
import { KycDocumentStatus } from '#features/kyc/domain/enum/kyc_enum'

export const processKycValidator = vine.compile(
  vine.object({
    status: vine.enum(KycDocumentStatus),
    comment: vine
      .string()
      .trim()
      .minLength(3)
      .optional()
      .requiredWhen('status', '=', KycDocumentStatus.REJECTED),
  })
)

export const processKycErrorMessages = {
  'status.required': 'Le statut est obligatoire',
  'status.enum': 'Le statut est invalide',
  'comment.requiredWhen': 'Une raison est obligatoire lors du rejet du document',
  'comment.minLength': 'La raison doit contenir au moins 3 caractères',
}
