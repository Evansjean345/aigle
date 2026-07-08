import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'

/**
 * Résolution d'un QR marchand scanné par le consumer.
 *
 * Le client a déjà distingué un QR marchand (préfixe `aiglepay:merchant:`) d'un
 * QR P2P au scan ; il envoie ici le code brut. Fin wrapper vers la capacité core
 * PayableAliasService.resolve. N'expose QUE le nom + l'état : l'account_id reste
 * côté serveur (le paiement prendra le code et résoudra le compte en interne).
 */
@inject()
export default class MerchantQrController {
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