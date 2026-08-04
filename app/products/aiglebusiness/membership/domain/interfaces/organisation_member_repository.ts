import type OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { type MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ListOrganisationMembersQuery } from '#aiglebusiness/membership/domain/types/organisation_member_repository_types'

/**
 * Port de persistance des membres d'organisation.
 */
export default abstract class OrganisationMemberRepository {
  /**
   * Crée un membre.
   */
  abstract create(
    data: Partial<OrganisationMember>,
    trx?: TransactionClientContract
  ): Promise<OrganisationMember>

  /**
   * Retrouve un membre par id (rôle préchargé).
   */
  abstract findById(id: number): Promise<OrganisationMember | null>

  /**
   * Retrouve la ligne (org, user) quel que soit son statut (unicité).
   */
  abstract findByOrganisationAndUser(
    organisationId: string,
    userId: string,
    trx?: TransactionClientContract
  ): Promise<OrganisationMember | null>

  /**
   * Retrouve un membre par son token d'invitation (rôle préchargé).
   */
  abstract findByInvitationToken(token: string): Promise<OrganisationMember | null>

  /**
   * Liste les membres d'une organisation (rôle préchargé).
   */
  abstract listByOrganisation(organisationId: string): Promise<OrganisationMember[]>

  /**
   * Appartenances **ACTIVES** d'un utilisateur (rôle + permissions préchargés).
   * L'OWNER en fait partie (seedé à la création). Base du « mes organisations ».
   */
  abstract listActiveByUser(userId: string): Promise<OrganisationMember[]>

  /**
   * Met à jour le statut d'un membre (et efface éventuellement le token).
   */
  abstract updateStatus(
    memberId: number,
    status: MemberStatus,
    clearInvitation?: boolean,
    trx?: TransactionClientContract
  ): Promise<void>

  /**
   * Réaffecte le rôle d'un membre.
   */
  abstract updateRole(
    memberId: number,
    roleId: number,
    trx?: TransactionClientContract
  ): Promise<void>

  /**
   * Pose/renouvelle le token d'invitation et son expiration, et (ré)active le
   * statut PENDING + le rôle proposé.
   */
  abstract setInvitation(
    memberId: number,
    roleId: number,
    token: string,
    expiresAt: import('luxon').DateTime,
    trx?: TransactionClientContract
  ): Promise<void>

  /**
   * Supprime définitivement une ligne membre (annulation d'invitation PENDING).
   */
  abstract delete(memberId: number, trx?: TransactionClientContract): Promise<void>

  /**
   * Nombre de membres ACTIFS portant un rôle donné (garde-fou suppression de rôle).
   */
  abstract countActiveByRole(roleId: number): Promise<number>

  /**
   * Compte les membres actifs de plusieurs organisations en une requête.
   *
   * @param {string[]} organisationIds - Identifiants publics des organisations.
   * @returns {Promise<Map<string, number>>} Le compte par organisation. Une organisation sans membre
   * actif est absente de la table.
   */
  abstract countActiveByOrganisationIds(organisationIds: string[]): Promise<Map<string, number>>

  /**
   * Compte les membres actifs de plusieurs rôles en une requête.
   *
   * @param {number[]} roleIds - Identifiants des rôles.
   * @returns {Promise<Map<number, number>>} Le compte par rôle. Un rôle sans membre actif est absent
   * de la table — l'appelant lit alors zéro, ce qui est l'information cherchée.
   */
  abstract countActiveByRoleIds(roleIds: number[]): Promise<Map<number, number>>

  /**
   * Liste paginée des membres d'une organisation, rôle préchargé.
   *
   * @param {string} organisationId - Organisation consultée.
   * @param {ListOrganisationMembersQuery} query - Filtres et pagination, déjà normalisés.
   * @returns {Promise<ModelPaginatorContract<OrganisationMember>>} La page demandée et son total.
   */
  abstract listPaginatedByOrganisation(
    organisationId: string,
    query: ListOrganisationMembersQuery
  ): Promise<ModelPaginatorContract<OrganisationMember>>

  /**
   * Identifiants des utilisateurs membres d'une organisation.
   *
   * Une seule colonne : sert à résoudre une recherche par nom sans charger les lignes entières.
   *
   * @param {string} organisationId - Organisation consultée.
   * @returns {Promise<string[]>} Les identifiants, sans doublon.
   */
  abstract listUserIdsByOrganisation(organisationId: string): Promise<string[]>

  /**
   * Compte les membres d'une organisation par statut.
   *
   * Porté par le serveur et non déduit de la page chargée : un compte calculé sur vingt lignes
   * décrirait la page, pas l'organisation.
   *
   * @param {string} organisationId - Organisation consultée.
   * @returns {Promise<Map<MemberStatus, number>>} Le compte par statut. Un statut sans membre est
   * absent de la table.
   */
  abstract countByStatus(organisationId: string): Promise<Map<MemberStatus, number>>
}
