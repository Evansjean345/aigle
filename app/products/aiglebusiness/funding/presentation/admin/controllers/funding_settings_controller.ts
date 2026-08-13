
import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import FundingSettingsRepository from '#aiglebusiness/funding/domain/interfaces/funding_settings_repository'
import { updateFundingSettingsValidator } from '#aiglebusiness/funding/presentation/admin/validators/funding_request_validators'
import { AdminFundingSettingsResponseDTO } from '#aiglebusiness/funding/application/dtos/admin/admin_funding_settings.dto'
import type Admin from '#core/team/domain/models/admin'

/**
 * Réglages du réapprovisionnement : consultation et modification du seuil de double validation.
 *
 * Gardé par une permission distincte de celle de validation : qui règle le seuil règle le contrôle.
 */
@inject()
export default class AdminFundingSettingsController {
  constructor(private readonly repository: FundingSettingsRepository) {}

  /** Renvoie le seuil courant, ou `null` s'il n'est pas encore configuré. */
  async show({ response }: HttpContext): Promise<void> {
    const settings = await this.repository.find()

    return response.ok({
      data: settings ? AdminFundingSettingsResponseDTO.fromSettings(settings) : null,
    })
  }

  /** Enregistre le seuil de double validation et journalise son auteur. */
  async update({ request, response, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateFundingSettingsValidator)
    const admin = auth.getUserOrFail() as Admin

    const settings = await this.repository.saveThreshold(payload.doubleApprovalThreshold, admin.id)

    return response.ok({ data: AdminFundingSettingsResponseDTO.fromSettings(settings) })
  }
}
