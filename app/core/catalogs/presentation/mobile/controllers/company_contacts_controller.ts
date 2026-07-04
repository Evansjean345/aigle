import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import GetActiveCompanyContactsUseCase from '#core/catalogs/application/use_cases/company_contacts/get_active_contacts'

@inject()
export default class CompanyContactsController {
  /**
   * Creates an instance of the class with the provided method to fetch active company contacts.
   *
   * @param {GetActiveCompanyContactsUseCase} getActiveContacts - The use case instance responsible for retrieving active company contacts.
   */
  constructor(private getActiveContacts: GetActiveCompanyContactsUseCase) {}

  /**
   * Handles the retrieval of active contacts and sends them in the HTTP response.
   *
   * @param {Object} ctx - The context object containing request and response objects.
   * @param {Object} ctx.response - The HTTP response object used to send data back to the client.
   * @return {Promise<void>} A promise that resolves when the active contacts are successfully retrieved and sent in the response.
   */
  async index({ response }: HttpContext): Promise<void> {
    const contacts = await this.getActiveContacts.execute()
    return response.ok(contacts)
  }
}
