import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import User from '#core/identity/user/domain/models/user'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { UserStatus } from '#core/identity/user/domain/enum'
import UserStateChanged from '#core/identity/user/application/events/user_state_changed'
import {
  toUserListItemResult,
  toUserSearchResult,
  toUserDetailsResult,
  type PaginatedUsersResult,
  type UserSearchResult,
  type UserDetailsResult,
  type UserWalletStatsResult,
} from '#core/identity/user/application/dtos/user_admin.dto'

/**
 * Annuaire des utilisateurs pour l'administration.
 *
 * Distinct de `UserDirectoryService`, qui résout une identité minimale pour les produits : ce
 * service porte ce que le back-office affiche et les décisions qu'il prend sur un compte.
 */
@inject()
export default class UserAdminService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly transactionVolumeCache: TransactionVolumeCache,
    private readonly transactionRepository: TransactionRepository
  ) {}

  /**
   * Liste les utilisateurs, paginés, avec leur volume mensuel.
   *
   * @param {number} page - Page demandée.
   * @param {number} perPage - Taille de page.
   * @param {string} [search] - Fragment de nom ou de téléphone.
   * @param {string} [startDate] - Borne basse de création.
   * @param {string} [endDate] - Borne haute de création.
   * @returns {Promise<PaginatedUsersResult>} La page et ses métadonnées.
   */
  async list(
    page: number,
    perPage: number,
    search?: string,
    startDate?: string,
    endDate?: string
  ): Promise<PaginatedUsersResult> {
    const paginated = await this.userRepository.paginate(
      page,
      perPage,
      ['wallet', 'keyLevel', 'kycDocument', 'country'],
      search,
      startDate,
      endDate
    )

    const items = paginated.all()
    const userIds = items.map((user) => user.usersUid)
    const since = startDate ? DateTime.fromISO(startDate) : undefined
    const volumes = await this.transactionVolumeCache.getMonthlyVolumesForUsers(userIds, since)

    return {
      data: items.map((user) =>
        toUserListItemResult(user, { monthlyVolume: volumes[user.usersUid] || 0 })
      ),
      meta: {
        total: paginated.total,
        currentPage: paginated.currentPage,
        firstPage: paginated.firstPage,
        lastPage: paginated.lastPage,
        perPage: paginated.perPage,
      },
    }
  }

  /**
   * Recherche des utilisateurs pour un champ d'autocomplétion.
   *
   * @param {string} search - Fragment recherché.
   * @returns {Promise<UserSearchResult[]>} Les correspondances, plafonnées.
   */
  async search(search: string): Promise<UserSearchResult[]> {
    const paginated = await this.userRepository.paginate(
      1,
      6,
      ['kycDocument', 'country', 'keyLevel'],
      search
    )

    return paginated.all().map(toUserSearchResult)
  }

  /**
   * Charge la fiche complète d'un utilisateur.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<UserDetailsResult | null>} La fiche, ou `null` si le compte n'existe pas.
   */
  async findDetails(userId: string): Promise<UserDetailsResult | null> {
    const user = await this.userRepository.findWithAdminDetails(userId)

    return user ? toUserDetailsResult(user) : null
  }

  /**
   * Compteurs de l'annuaire.
   *
   * @param {string} [startDate] - Borne basse de création.
   * @param {string} [endDate] - Borne haute de création.
   * @returns {Promise<Record<string, number>>} Les compteurs globaux.
   */
  async getStats(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    return this.userRepository.getStats(startDate, endDate)
  }

  /**
   * Portefeuille d'un utilisateur et son activité récente.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<UserWalletStatsResult>} Solde, plafonds et activité du jour.
   * @throws {Exception} Compte inconnu, ou portefeuille et limites KYC absents.
   */
  async getWalletStats(userId: string): Promise<UserWalletStatsResult> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new Exception('Utilisateur non trouvé', { status: 404 })
    }

    await Promise.all([user.load('wallet'), user.load('keyLevel')])

    const wallet = user.wallet
    const kycLevel = user.keyLevel

    if (!wallet || !kycLevel) {
      throw new Exception('Données de portefeuille ou de limites KYC manquantes', { status: 404 })
    }

    const [todayVolume, monthVolume] = await Promise.all([
      this.transactionVolumeCache.getDailyVolume(user.usersUid),
      this.transactionVolumeCache.getMonthlyVolume(user.usersUid),
    ])

    const today = new Date().toISOString().split('T')[0]

    const [todayTxCount, lastTx] = await Promise.all([
      this.transactionRepository.countSuccessByDate(user.usersUid, today),
      this.transactionRepository.findLastSuccessByUserId(user.usersUid),
    ])

    return {
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currencySymbol || 'FCFA',
        status: wallet.status,
        limitPerTransaction: kycLevel.singleLimit,
        limitDaily: kycLevel.dailyLimit,
        limitMonthly: kycLevel.monthlyLimit,
        balanceLimit: kycLevel.balanceLimit,
      },
      activity: {
        todayTxCount,
        todayVolume,
        monthVolume,
        lastTxDate: lastTx ? lastTx.createdAt.toISO() : null,
        lastTxAmount: lastTx ? lastTx.amount : null,
      },
    }
  }

  /**
   * Change l'état d'un compte utilisateur.
   *
   * Bloquer révoque toutes les sessions : le compte ne doit pas rester joignable avec un jeton
   * émis avant la décision.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {UserStatus} status - Nouvel état.
   * @throws {Exception} Compte inconnu, état identique, ou compte inactif ou rejeté.
   */
  async changeState(userId: string, status: UserStatus): Promise<void> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new Exception('Utilisateur introuvable', { status: 404, code: 'USER_NOT_FOUND' })
    }

    if (user.status === status) {
      throw new Exception("Le statut de l'utilisateur est déjà le même", {
        status: 400,
        code: 'SAME_STATUS',
      })
    }

    if (user.status === UserStatus.INACTIVE || user.status === UserStatus.REJECTED) {
      throw new Exception("Impossible de modifier le statut d'un utilisateur inactif ou rejeté", {
        status: 400,
        code: 'INVALID_USER_STATE',
      })
    }

    user.status = status
    const updated = await this.userRepository.save(user)

    if (updated && updated.status === UserStatus.BLOCKED) {
      const tokens = await User.accessTokens.all(user)
      await Promise.all(tokens.map((token) => User.accessTokens.delete(user, token.identifier)))
    }

    await UserStateChanged.dispatch(userId, status)
  }
}
