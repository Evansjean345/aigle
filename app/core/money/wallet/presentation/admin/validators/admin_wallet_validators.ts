import vine from '@vinejs/vine'

/**
 * Gel ou dégel du portefeuille d'un utilisateur.
 *
 * Le motif est requis et non trivial : interrompre les mouvements d'un compte doit pouvoir
 * s'expliquer des mois plus tard. Le sens de la bascule vient de la route, pas du corps.
 */
export const walletFreezeValidator = vine.create(
  vine.object({
    reason: vine.string().trim().minLength(10).maxLength(500),
  })
)
