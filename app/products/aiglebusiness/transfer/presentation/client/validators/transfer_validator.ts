import vine from '@vinejs/vine'

/**
 * Payload d'un **transfert unique** business : montant, bénéficiaire mobile money (téléphone +
 * opérateur), et moyen de paiement catalogue. Le type de transaction est fixé côté serveur.
 */
export const transferValidator = vine.compile(
  vine.object({
    amount: vine.number().positive().min(1),
    phone: vine.string().trim().minLength(1),
    providerCode: vine.string().trim().minLength(1),
    paymentMethodCode: vine.string().trim().minLength(1),
  })
)
