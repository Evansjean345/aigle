import vine from '@vinejs/vine'
import { KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'

export const kycDocumentValidator = vine.compile(
  vine.object({
    document_type: vine.enum(KycDocumentType),
    document_recto: vine.file({
      extnames: ['png', 'jpg', 'jpeg'],
      size: '5mb',
    }),
    document_verso: vine
      .file({
        extnames: ['png', 'jpg', 'jpeg'],
        size: '5mb',
      })
      .optional()
      .requiredWhen('document_type', 'in', [KycDocumentType.CNI, KycDocumentType.PERMIT_CONDUIT]),
    selfie_image: vine.file({
      extnames: ['png', 'jpg', 'jpeg'],
      size: '10mb',
    }),
  })
)

export const errorMessages = {
  'document_type.required': 'Le type de document est obligatoire',
  'document_type.enum': "Le type de document n'est pas valide",
  'document_recto.required': 'Le recto du document est obligatoire',
  'document_recto.file.size': 'Le fichier ne doit pas dépasser 5 Mo',
  'document_recto.file.extname': 'Le fichier doit être au format JPG, PNG ou JPEG',
  'document_verso.file.size': 'Le fichier ne doit pas dépasser 5 Mo',
  'document_verso.file.extname': 'Le fichier doit être au format JPG, PNG ou JPEG',
  'selfie_image.required': 'La photo selfie est obligatoire',
  'selfie_image.file.size': 'Le fichier ne doit pas dépasser 10 Mo',
  'selfie_image.file.extname': 'Le fichier doit être au format JPG, PNG ou JPEG',
}
