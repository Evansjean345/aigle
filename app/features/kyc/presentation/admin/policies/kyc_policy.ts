import { BasePolicy } from '@adonisjs/bouncer'
import type Admin from '#features/team/domain/models/admin'
import { adminHasPermission } from '#shared/authorization/permission_helpers'

export default class KycPolicy extends BasePolicy {
  /**
   * Determines if the given admin user has permission to view any KYC records.
   *
   * @param {Admin} user - The admin user whose permissions are being checked.
   * @return {Promise<boolean>} A promise that resolves to true if the user has the 'kyc.read' permission, otherwise false.
   */
  async viewAny(user: Admin): Promise<boolean> {
    return adminHasPermission(user, 'kyc.read')
  }

  /**
   * Checks if the provided admin user has permission to view KYC-related information.
   *
   * @param {Admin} user - The admin user whose permissions are being verified.
   * @return {Promise<boolean>} A promise that resolves to true if the user has the 'kyc.read' permission, otherwise false.
   */
  async view(user: Admin): Promise<boolean> {
    return adminHasPermission(user, 'kyc.read')
  }

  /**
   * Approves the given user's permissions for KYC approval.
   *
   * @param {Admin} user - The admin user requesting approval permissions.
   * @return {Promise<boolean>} True if the user has the required permission, otherwise false.
   */
  async approve(user: Admin): Promise<boolean> {
    return adminHasPermission(user, 'kyc.approve')
  }

  /**
   * Rejects a specific operation based on the permission of the given admin user.
   *
   * @param {Admin} user - The admin user whose permissions will be checked for the reject operation.
   * @return {Promise<boolean>} A promise that resolves to a boolean indicating whether the admin has the required permission.
   */
  async reject(user: Admin): Promise<boolean> {
    return adminHasPermission(user, 'kyc.reject')
  }
}
