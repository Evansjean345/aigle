import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CollectionAccountService from '#aiglebusiness/funding/application/services/collection_account_service'
import { CollectionAccountResponseDTO } from '#aiglebusiness/funding/application/dtos/collection_account.dto'

/**
 * Catalogue consulté par le marchand pour savoir où verser.
 *
 * Lecture seule, et uniquement les comptes actifs.
 */
@inject()
export default class ClientCollectionAccountsController {
  constructor(private readonly service: CollectionAccountService) {}

  async index({ response }: HttpContext): Promise<void> {
    const accounts = await this.service.listActive()

    return response.ok({ data: accounts.map(CollectionAccountResponseDTO.fromAccount) })
  }
}
