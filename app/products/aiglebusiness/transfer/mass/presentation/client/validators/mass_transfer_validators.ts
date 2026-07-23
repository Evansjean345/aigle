import vine from '@vinejs/vine'

/**
 * Payload d'un **paiement en masse** business : une liste de bénéficiaires mobile money. Cap **50**
 * (L2-D8) — au-delà, la voie fichier XLSX (différée, B7). Le type/mécanique argent est fixé serveur.
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
