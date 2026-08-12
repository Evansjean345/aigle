import { inject } from '@adonisjs/core'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import AccountRepository from '#core/identity/account/domain/interfaces/account_repository'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { type AccountStatus } from '#core/identity/account/domain/enums/account_status'
import { type OpenAccountCommand } from '#core/identity/account/application/dtos/account.dto'
import { requirementsFor } from '#core/identity/kyc/domain/verification_requirements'
import type Account from '#core/identity/account/domain/models/account'
import AccountOpened from '#core/identity/account/application/events/account_opened'

/**
 * Porte d'écriture des comptes (identity) — refactor account-centric β.
 *
 * `openAccount` crée le compte de façon **idempotente** (segment + niveau portés par le compte).
 * Le **wallet n'est PAS créé ici** : c'est le contexte **money** qui écoute `AccountOpened` et le
 * crée → dépendance **unidirectionnelle `money → identity`** (identity n'appelle jamais money).
 *
 * Règle d'émission (atomicité) :
 *  - **sans `trx`** (appelant sans transaction ouverte) → `openAccount` **annonce lui-même**
 *    (`AccountOpened` dispatché, awaité → wallet créé de façon synchrone) ;
 *  - **avec `trx`** (register, create_organisation) → `openAccount` **n'annonce PAS** ; l'appelant
 *    appelle `announceOpened(account)` **après commit** (le wallet est créé post-commit, hors trx —
 *    atomicité compte↔wallet éventuelle, cf. décision option 2).
 */
@inject()
export default class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  /**
   * Ouvre (idempotent) le compte du propriétaire. N'écrase pas le segment/niveau d'un compte
   * existant (le niveau peut avoir été relevé par la vérification).
   *
   * Le niveau de départ vient du profil de vérification : l'appelant nomme ce qu'il attend du
   * compte, le core en déduit d'où celui-ci part.
   */
  async openAccount(
    command: OpenAccountCommand,
    trx?: TransactionClientContract
  ): Promise<Account> {
    const existing = await this.accountRepository.findByOwner(
      command.ownerType,
      command.ownerRef,
      trx
    )

    const account =
      existing ??
      (await this.accountRepository.create(
        {
          accountId: command.ownerRef,
          ownerType: command.ownerType,
          ownerRef: command.ownerRef,
          segment: command.segment,
          verificationProfile: command.verificationProfile,
          level: requirementsFor(command.verificationProfile).startsAtLevel,
        },
        trx
      ))

    if (!trx) {
      await this.announceOpened(account)
    }

    return account
  }

  /**
   * Annonce l'ouverture du compte ('AccountOpened`) → money crée le wallet. À appeler **après
   * commit** par les appelants transactionnels. Idempotent côté money ('createForAccount`).
   */
  /**
   * Indique si un propriétaire a déjà son compte.
   *
   * @param {AccountOwnerType} ownerType - Nature du propriétaire.
   * @param {string} ownerRef - Référence du propriétaire.
   * @returns {Promise<boolean>} `true` si le compte existe.
   */
  async exists(ownerType: AccountOwnerType, ownerRef: string): Promise<boolean> {
    const account = await this.accountRepository.findByOwner(ownerType, ownerRef)

    return account !== null
  }

  async announceOpened(account: Account): Promise<void> {
    await AccountOpened.dispatch({
      accountId: account.accountId,
      ownerType: account.ownerType,
      ownerRef: account.ownerRef,
      userId: account.ownerType === AccountOwnerType.USER ? account.ownerRef : null,
    })
  }

  /**
   * Met à jour le **niveau** du compte (push-sync depuis la vérification : KYC user / KYB org).
   * No-op si le compte n'existe pas encore (sera créé au provisioning avec son niveau).
   *
   * @param accountId Compte cible.
   * @param level Nouveau niveau (→ nouvelles limites via `(segment, level)`).
   */
  async setLevel(accountId: string, level: number): Promise<void> {
    const account = await this.accountRepository.findByAccountId(accountId)
    if (!account) return
    account.level = level
    await this.accountRepository.save(account)
  }

  /**
   * Met à jour le **statut opérationnel** du compte (push-sync depuis le propriétaire : `user.status`
   * / `organisation.status`, à chaque changement). Lu par la validation money. No-op si le compte
   * n'existe pas encore.
   *
   * @param accountId Compte cible.
   * @param status Nouveau statut (`ACTIVE` | `BLOCKED`).
   */
  async setStatus(accountId: string, status: AccountStatus): Promise<void> {
    const account = await this.accountRepository.findByAccountId(accountId)
    if (!account) return
    account.status = status
    await this.accountRepository.save(account)
  }
}
