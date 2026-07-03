import type Wallet from '#features/wallet/domain/models/wallet'

/**
 * Read-model exposé par wallet-core pour désigner un compte bénéficiaire.
 *
 * Évite de laisser fuiter le modèle ORM `Wallet` hors de sa couche : ne porte que l'identité de
 * compte (`usersUid`) et le téléphone dont les consommateurs (produit) ont besoin — pas de solde,
 * statut, token, ni relations. Construit à partir d'un `Wallet` dont la relation `user` est chargée.
 */
export class RecipientAccount {
  declare usersUid: string
  declare phone: string

  static fromWallet(wallet: Wallet): RecipientAccount {
    const dto = new RecipientAccount()
    dto.usersUid = wallet.user.usersUid
    dto.phone = wallet.user.phone
    return dto
  }
}
