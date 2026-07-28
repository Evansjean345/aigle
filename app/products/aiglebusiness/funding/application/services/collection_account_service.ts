import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import CollectionAccountRepository from '#aiglebusiness/funding/domain/interfaces/collection_account_repository'
import CollectionAccountDuplicateException from '#aiglebusiness/funding/domain/exceptions/collection_account_duplicate_exception'
import CollectionAccountNotFoundException from '#aiglebusiness/funding/domain/exceptions/collection_account_not_found_exception'
import type CollectionAccount from '#aiglebusiness/funding/domain/models/collection_account'
import type {
  CreateCollectionAccountCommand,
  UpdateCollectionAccountCommand,
} from '#aiglebusiness/funding/application/dtos/collection_account.dto'

/**
 * Catalogue des comptes de collecte (F1).
 *
 * Deux invariants de sûreté, portés ici parce qu'ils protègent de l'argent :
 *
 * 1. **Identifiant immuable** (R-D6) — `update` n'accepte pas `accountIdentifier'. Le modifier
 *    détournerait tous les versements suivants ; changer de compte = désactiver + recréer. Le type
 *    de la commande l'interdit, et l'implémentation ne le lit pas : même un appelant en `as never`
 *    ne peut pas le faire passer.
 * 2. **Pas de suppression** — seulement `setActive(false)'. Les demandes passées référencent leur
 *    canal ; le supprimer rendrait l'historique illisible.
 */
@inject()
export default class CollectionAccountService {
  constructor(private readonly repository: CollectionAccountRepository) {}

  async create(command: CreateCollectionAccountCommand): Promise<CollectionAccount> {
    const existing = await this.repository.findByIdentifier(command.accountIdentifier)

    if (existing) {
      throw new CollectionAccountDuplicateException()
    }

    return this.repository.create({
      reference: this.generateReference(),
      label: command.label,
      type: command.type,
      accountIdentifier: command.accountIdentifier,
      accountHolder: command.accountHolder,
      instructions: command.instructions ?? null,
      isActive: true,
      displayOrder: command.displayOrder ?? 0,
    })
  }

  /**
   * Met à jour les champs **éditables** uniquement. Toute autre propriété passée par l'appelant est
   * ignorée par construction — on ne recopie jamais la commande en bloc.
   */
  async update(
    reference: string,
    command: UpdateCollectionAccountCommand
  ): Promise<CollectionAccount> {
    const account = await this.getOrFail(reference)

    if (command.label !== undefined) account.label = command.label
    if (command.accountHolder !== undefined) account.accountHolder = command.accountHolder
    if (command.instructions !== undefined) account.instructions = command.instructions
    if (command.displayOrder !== undefined) account.displayOrder = command.displayOrder

    return this.repository.update(account)
  }

  /** Active/désactive. Remplace la suppression : le canal sort du catalogue marchand, reste en base. */
  async setActive(reference: string, isActive: boolean): Promise<CollectionAccount> {
    const account = await this.getOrFail(reference)
    account.isActive = isActive
    return this.repository.update(account)
  }

  /** Catalogue complet (admin). */
  listAll(): Promise<CollectionAccount[]> {
    return this.repository.listAll()
  }

  /** Ce que voit le marchand : jamais un compte fermé, sur lequel il ne doit pas verser. */
  listActive(): Promise<CollectionAccount[]> {
    return this.repository.listActive()
  }

  private async getOrFail(reference: string): Promise<CollectionAccount> {
    const account = await this.repository.findByReference(reference)

    if (!account) {
      throw new CollectionAccountNotFoundException()
    }

    return account
  }

  private generateReference(): string {
    return `collect_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
}
