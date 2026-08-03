import vine from '@vinejs/vine'

/**
 * Valide la demande d'initiation d'un lot : une liste de bénéficiaires mobile money, plafonnée à 50.
 */
export const massTransferValidator = vine.compile(
  vine.object({
    label: vine.string().trim().maxLength(120).optional(),
    description: vine.string().trim().maxLength(500).optional(),
    recipients: vine
      .array(
        vine.object({
          amount: vine.number().positive().min(1),
          phone: vine.string().trim().minLength(1),
          providerCode: vine.string().trim().minLength(1),
          name: vine.string().trim().maxLength(120).optional(),
          country: vine.string().trim().minLength(2).maxLength(3).optional(),
        })
      )
      .minLength(1)
      .maxLength(50),
  })
)
