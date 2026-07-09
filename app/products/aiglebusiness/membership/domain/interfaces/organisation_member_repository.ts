import type OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { type MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

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
    userId: string
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
   * Identifiants des organisations où l'utilisateur est membre **ACTIF** (l'OWNER
   * en fait partie, seedé à la création). Base du « mes organisations ».
   */
  abstract listActiveOrganisationIdsByUser(userId: string): Promise<string[]>

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
}
