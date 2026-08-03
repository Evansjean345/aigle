import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'

/**
 * Résolution PUBLIQUE d'un alias payable (QR marchand).
 *
 * Sert la page de paiement aigleplay : le payeur (pas forcément un utilisateur
 * Aigle) ouvre le lien du QR, la page résout le code pour afficher le marchand.
 * Endpoint core, produit-neutre et NON authentifié (audience `public`). Ne
 * renvoie que le nom + l'état — jamais l'account_id (le paiement, côté serveur,
 * reprend le code et résout le compte en interne).
 */
@inject()
export default class PayableAliasController {
  constructor(private readonly payableAliasService: PayableAliasService) {}

  async resolve({ params, response }: HttpContext): Promise<void> {
    const resolved = await this.payableAliasService.resolve(params.code)

    if (!resolved) {
      return response.notFound({ code: 'MERCHANT_QR_NOT_FOUND' })
    }

    return response.ok({
      displayName: resolved.displayName,
      active: resolved.active,
    })
  }
}
