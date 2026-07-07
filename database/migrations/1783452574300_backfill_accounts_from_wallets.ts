import { BaseSchema } from '@adonisjs/lucid/schema'
import Wallet from '#core/money/wallet/domain/models/wallet'
import Account from '#core/money/account/domain/models/account'
import { AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'

/**
 * Backfill de la fondation account pour les wallets consumer existants (commit 3/4).
 *
 * Pour chaque wallet existant possédant un users_uid : garantit un compte
 * (owner_type=user, owner_ref=account_id=users_uid) et renseigne wallet.account_id
 * = users_uid (account_id dérivé). Idempotent.
 *
 * Précautions :
 * - lecture de `wallet.userId` via le modèle (Lucid mappe la colonne réelle,
 *   agnostique de la divergence de nommage user_id/users_uid) ;
 * - mise à jour du wallet via le QUERY BUILDER (`.update()`), qui NE déclenche PAS
 *   le hook @beforeSave régénérant walletsUid — un `wallet.save()` corromprait
 *   tous les walletsUid existants.
 */
export default class extends BaseSchema {
  async up() {
    const wallets = await Wallet.query().whereNull('accountId')

    for (const wallet of wallets) {
      const ownerRef = wallet.userId
      if (!ownerRef) continue // wallet sans user (aucun aujourd'hui) : ignoré

      const existingAccount = await Account.query()
        .where('owner_type', AccountOwnerType.USER)
        .where('owner_ref', ownerRef)
        .first()

      if (!existingAccount) {
        await Account.create({
          accountId: ownerRef,
          ownerType: AccountOwnerType.USER,
          ownerRef,
        })
      }

      await Wallet.query().where('id', wallet.id).update({ accountId: ownerRef })
    }
  }

  async down() {
    // Réversible : on retire les comptes user dérivés et on vide account_id.
    await Wallet.query().update({ accountId: null })
    await Account.query().where('owner_type', AccountOwnerType.USER).delete()
  }
}
