import { inject } from '@adonisjs/core'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
import { AccountActivityPointResponseDTO } from '#core/money/transactions/application/dtos/account_activity.dto'

/**
 * Courbe d'activité d'un compte sur une période, un point par jour mouvementé.
 *
 * Les jours sans écriture sont absents : c'est au client de les combler s'il veut un axe continu.
 */
@inject()
export default class GetAccountActivityChartUseCase {
  constructor(private readonly ledgerService: LedgerService) {}

  /**
   * @param {string} accountId - Compte titulaire, l'`organisationId` pour une entreprise.
   * @param {string} startDate - Premier jour inclus, au format `YYYY-MM-DD`.
   * @param {string} endDate - Dernier jour inclus, au format `YYYY-MM-DD`.
   * @returns {Promise<AccountActivityPointResponseDTO[]>} La courbe, du plus ancien au plus récent.
   */
  async execute(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<AccountActivityPointResponseDTO[]> {
    const days = await this.ledgerService.getDailyAccountActivity(accountId, startDate, endDate)

    return AccountActivityPointResponseDTO.fromDays(days)
  }
}
