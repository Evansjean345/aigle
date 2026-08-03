import type { ApplicationService } from '@adonisjs/core/types'
import AccountOperationalGuard from '#core/money/transfer/domain/interfaces/account_operational_guard'
import PartyValidator from '#core/money/money_movement/application/services/party_validator'

/**
 * Wiring de la feature `transfer` (paiement en masse).
 *
 * Binde le contrat `AccountOperationalGuard` sur `PartyValidator`, qui porte déjà les contrôles de
 * statut du compte et de son portefeuille. La feature déclare ainsi son besoin sans dépendre du
 * service qui le satisfait.
 *
 * Binding transient (`bind`, pas `singleton`) : le validateur est sans état, et le transient garde
 * la couture testable — un `container.swap` d'un test se propage à une chaîne fraîchement résolue.
 */
export default class TransferProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind(AccountOperationalGuard, () => {
      return this.app.container.make(PartyValidator)
    })
  }
}
