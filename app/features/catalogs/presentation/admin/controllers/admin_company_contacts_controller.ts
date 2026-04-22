import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import GetAllCompanyContactsUseCase from '#features/catalogs/application/use_cases/company_contacts/get_all_contacts'
import UpdateCompanyContactUseCase from '#features/catalogs/application/use_cases/company_contacts/update_contact'
import { updateCompanyContactValidator } from '#features/catalogs/presentation/admin/validators/company_contact_validator'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class AdminCompanyContactsController {
  /**
   * Constructor for initializing dependencies required for managing company contacts.
   *
   * @param {GetAllCompanyContactsUseCase} getAllContacts - Use case for retrieving all company contacts.
   * @param {UpdateCompanyContactUseCase} updateContact - Use case for updating a specific company contact.
   */
  constructor(
    private getAllContacts: GetAllCompanyContactsUseCase,
    private updateContact: UpdateCompanyContactUseCase
  ) {}

  /**
   * Handles the retrieval of all contacts and sends an HTTP response with the data.
   *
   * @param {Object} HttpContext - The context object containing the HTTP request and response.
   * @param {Object} HttpContext.response - The response object used to send the HTTP response.
   * @return {Promise<void>} A promise that resolves when the response is sent.
   */
  async index({ response }: HttpContext): Promise<void> {
    const contacts = await this.getAllContacts.execute()
    return response.ok(contacts)
  }

  /**
   * Updates a company contact with the provided data.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.request - The HTTP request object.
   * @param {Object} context.response - The HTTP response object.
   * @param {Object} context.params - The route parameters.
   * @param {string} context.params.id - The ID of the contact to be updated.
   * @return {Promise<void>} The updated contact data.
   */
  async update({ request, response, params, auth }: HttpContext): Promise<void> {
    try {
      const payload = await request.validateUsing(updateCompanyContactValidator)
      const contact = await this.updateContact.execute(params.id, payload)

      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'COMPANY_CONTACT_UPDATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'CompanyContact',
          targetId: String(params.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          newValues: payload,
          result: AuditResult.SUCCESS,
        })
        .catch((_) => {})

      return response.ok(contact)
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'COMPANY_CONTACT_UPDATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'CompanyContact',
          targetId: String(params.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message,
        })
        .catch((_) => {})
      throw error
    }
  }
}
