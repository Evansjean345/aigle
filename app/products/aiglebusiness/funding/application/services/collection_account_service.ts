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
 * Gestion du catalogue des comptes de collecte : création, mise à jour, activation et lecture.
 *
 * L'identifiant bancaire n'est modifiable par aucune méthode, et aucun compte ne se supprime.
 */
@inject()
export default class CollectionAccountService {
  constructor(private readonly repository: CollectionAccountRepository) {}

  /**
   * Crée un compte de collecte, actif par défaut.
   *
   * @param {CreateCollectionAccountCommand} command - Libellé, type, identifiant bancaire, titulaire,
   * consignes et ordre d'affichage.
   * @returns {Promise<CollectionAccount>} Le compte créé.
   * @throws {CollectionAccountDuplicateException} Un compte porte déjà cet identifiant.
   */
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
   * Met à jour les champs éditables. Les autres propriétés sont ignorées : la commande n'est jamais
   * recopiée en bloc.
   *
   * @param {string} reference - Référence du compte.
   * @param {UpdateCollectionAccountCommand} command - Libellé, titulaire, consignes, ordre.
   * @returns {Promise<CollectionAccount>} Le compte mis à jour.
   * @throws {CollectionAccountNotFoundException} Référence inconnue.
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

  /**
   * Active ou désactive un compte. Remplace la suppression : le compte reste en base.
   *
   * @param {string} reference - Référence du compte.
   * @param {boolean} isActive - Nouvel état.
   * @returns {Promise<CollectionAccount>} Le compte mis à jour.
   * @throws {CollectionAccountNotFoundException} Référence inconnue.
   */
  async setActive(reference: string, isActive: boolean): Promise<CollectionAccount> {
    const account = await this.getOrFail(reference)
    account.isActive = isActive
    return this.repository.update(account)
  }

  /**
   * Liste tout le catalogue, actifs et inactifs.
   *
   * @returns {Promise<CollectionAccount[]>} Tous les comptes de collecte.
   */
  listAll(): Promise<CollectionAccount[]> {
    return this.repository.listAll()
  }

  /**
   * Liste les comptes proposés au marchand.
   *
   * @returns {Promise<CollectionAccount[]>} Les comptes actifs uniquement.
   */
  listActive(): Promise<CollectionAccount[]> {
    return this.repository.listActive()
  }

  /**
   * Retrouve un compte sans lever si la référence est inconnue.
   *
   * Utilisé pour enrichir l'affichage d'une demande : un compte introuvable ne doit pas faire
   * échouer la réponse.
   *
   * @param {string} reference - Référence du compte.
   * @returns {Promise<CollectionAccount | null>} Le compte, ou `null`.
   */
  findByReference(reference: string): Promise<CollectionAccount | null> {
    return this.repository.findByReference(reference)
  }

  /**
   * Charge un compte ou lève.
   *
   * @param {string} reference - Référence du compte.
   * @returns {Promise<CollectionAccount>} Le compte correspondant.
   * @throws {CollectionAccountNotFoundException} Référence inconnue.
   */
  private async getOrFail(reference: string): Promise<CollectionAccount> {
    const account = await this.repository.findByReference(reference)

    if (!account) {
      throw new CollectionAccountNotFoundException()
    }

    return account
  }

  /**
   * Génère la référence publique d'un compte.
   *
   * @returns {string} Une référence de la forme `collect_<12 caractères hexadécimaux>`.
   */
  private generateReference(): string {
    return `collect_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
}
