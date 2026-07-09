import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import PinAttemptGuard from '#core/identity/authentication/application/services/pin_attempt_guard'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'

/**
 * Vérifie le PIN d'un utilisateur par son id (contrat primitif, sans exposer le
 * modèle `User`), avec le garde anti-brute-force `PinAttemptGuard`. Utilisable par
 * les produits (ex : login business) via l'id résolu au préalable.
 */
@inject()
export default class PinVerificationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly pinAttemptGuard: PinAttemptGuard
  ) {}

  /**
   * Valide le PIN. Lève `InvalidPincodeException` si l'utilisateur est introuvable
   * ou le PIN incorrect ; propage les exceptions de blocage du garde.
   */
  async verify(userId: string, pincode: string): Promise<void> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new InvalidPincodeException()
    }

    await this.pinAttemptGuard.assertNotBlocked(user)

    if (!(await hash.verify(user.pincode, pincode))) {
      await this.pinAttemptGuard.recordFailure(user)
      throw new InvalidPincodeException()
    }

    await this.pinAttemptGuard.recordSuccess(user.id)
  }
}
