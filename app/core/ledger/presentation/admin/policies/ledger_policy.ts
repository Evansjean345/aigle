import { BasePolicy } from '@adonisjs/bouncer'
import type Admin from '#core/team/domain/models/admin'
import { adminHasPermission } from '#core/team/application/authorization/permission_helpers'
import { LEDGER_PERMISSIONS } from '#core/ledger/presentation/admin/permissions.config'

/**
 * A policy class that defines access control for ledger-related operations for admin users.
 * Extends the functionality of the BasePolicy class to handle ledger-specific permissions.
 */
export default class LedgerPolicy extends BasePolicy {
  /**
   * Checks if the given admin user has permission to view the ledger.
   *
   * @param {Admin} user - The admin user whose permissions need to be verified.
   * @return {Promise<boolean>} A promise resolving to `true` if the user has the required permission, otherwise `false`.
   */
  async viewLedgers(user: Admin): Promise<boolean> {
    return adminHasPermission(user, LEDGER_PERMISSIONS.ledgersRead)
  }

  /**
   * Retrieves and verifies if the admin user has permission to view the transactions report.
   *
   * @param {Admin} user - The admin user object requesting access to the transactions report.
   * @return {Promise<boolean>} A promise that resolves to a boolean value indicating whether the user has the required permissions.
   */
  async viewLedgersReport(user: Admin): Promise<boolean> {
    return adminHasPermission(user, LEDGER_PERMISSIONS.ledgersReportRead)
  }

  /**
   * Checks if the given user has permission to view user ledgers.
   *
   * @param {Admin} user - The admin user whose permissions are being checked.
   * @return {Promise<boolean>} A promise that resolves to a boolean indicating whether the user has the required permission.
   */
  async viewUserLedgers(user: Admin): Promise<boolean> {
    return adminHasPermission(user, LEDGER_PERMISSIONS.userLedgersRead)
  }

  /**
   * Fetches and provides access to the user ledgers report by verifying the provided user's permissions.
   *
   * @param {Admin} user - The admin user whose permissions will be validated to access the user ledgers report.
   * @return {Promise<boolean>} A promise that resolves to a boolean indicating whether the user has the required permission.
   */
  async viewUserLedgersReport(user: Admin): Promise<boolean> {
    return adminHasPermission(user, LEDGER_PERMISSIONS.userLedgersReportRead)
  }
}
