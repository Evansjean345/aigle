import vine from '@vinejs/vine'

/**
 * Payload d'un **transfert unique** business : montant, bénéficiaire mobile money (téléphone +
 * opérateur), moyen de paiement catalogue et mode de facturation des frais. Le type de transaction
 * est fixé côté serveur.
 */
export const transferValidator = vine.create(
  vine.object({
    amount: vine.number().positive().min(1),
    phone: vine.string().trim().minLength(1),
    providerCode: vine.string().trim().minLength(1),
    paymentMethodCode: vine.string().trim().minLength(1),
    /** `true` = le montant inclut déjà les frais (gross-up) ; absent = frais ajoutés au montant. */
    includeFees: vine.boolean().optional(),
    /** PIN à 5 chiffres du membre initiateur, vérifié en step-up avant le débit. */
    pinCode: vine.string().trim().minLength(5).maxLength(5),
  })
)
