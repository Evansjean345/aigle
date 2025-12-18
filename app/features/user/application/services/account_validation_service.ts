import User from '#features/user/domain/models/user'
import { UserStatus } from '#features/user/domain/enum'
import { Exception } from '@adonisjs/core/exceptions'
import { WalletStatus } from '#features/wallet/domain/enum/wallet_status'

/**
 * Service for validating user account status and associated wallet information.
 */
export default class AccountValidationService {
  /**
   * Validates the status of a user's account.
   *
   * @param {User} user - The user object whose account status is to be validated.
   * @return {void} Throws an exception if the user's account is inactive.
   */
  async validateAccount(user: User): Promise<void> {
    if (user.status !== UserStatus.ACTIVE) {
      throw new Exception('Votre compte est inactif. Veuillez contacter le service support.', {
        status: 403,
        code: 'E_ACCOUNT_INACTIVE',
      })
    }

    await user.load('wallet')

    if (!user.wallet) {
      throw new Exception('Aucun portefeuille associé à ce compte.', {
        status: 403,
        code: 'E_NO_WALLET_ASSOCIATED',
      })
    }

    if (user.wallet.status !== WalletStatus.Active) {
      throw new Exception(
        'Votre portefeuille est inactif. Veuillez contacter le service support.',
        {
          status: 403,
          code: 'E_WALLET_INACTIVE',
        }
      )
    }
  }
}
