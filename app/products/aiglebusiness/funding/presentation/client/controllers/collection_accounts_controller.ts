import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CollectionAccountService from '#aiglebusiness/funding/application/services/collection_account_service'
import { toCollectionAccountView } from '#aiglebusiness/funding/application/dtos/collection_account.dto'

/**
 * Catalogue vu par le marchand (F1) : **où verser** pour réapprovisionner son wallet.
 *
 * Lecture seule, et **uniquement les canaux actifs** — le marchand ne doit jamais pouvoir verser sur
 * un compte fermé. Le versement lui-même se fait **hors plateforme** (R-D1) ; cette liste ne
 * déclenche aucun mouvement.
 */
@inject()
export default class ClientCollectionAccountsController {
  constructor(private readonly service: CollectionAccountService) {}

  async index({ response }: HttpContext): Promise<void> {
    const accounts = await this.service.listActive()

    return response.ok({ data: accounts.map(toCollectionAccountView) })
  }
}
