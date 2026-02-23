import { BasePolicy } from '@adonisjs/bouncer'
import type Admin from '#features/team/domain/models/admin'
import { adminHasPermission } from '#shared/authorization/permission_helpers'
import { TRANSACTION_PERMISSIONS } from '#features/transactions/presentation/admin/permissions.config'

export default class TransactionPolicy extends BasePolicy {
  /**
   * Retrieves and verifies a user's permission to view transactions.
   *
   * @param {Admin} user - The admin user whose permissions will be checked.
   * @return {Promise<boolean>} A promise that resolves to true if the user has the required permission, otherwise false.
   */
  async viewTransactions(user: Admin): Promise<boolean> {
    return adminHasPermission(user, TRANSACTION_PERMISSIONS.transactionsRead)
  }

  /**
   * Checks if the given admin user has permission to view user data.
   *
   * @param {Admin} user The admin user whose permissions will be checked.
   * @return {Promise<boolean>} A promise resolving to true if the user has the required permission, otherwise false.
   */
  async viewTransaction(user: Admin): Promise<boolean> {
    console.log(user)
    return adminHasPermission(user, TRANSACTION_PERMISSIONS.transactionRead)
  }

  /**
   * Retrieves and verifies if the admin user has permission to view the transactions report.
   *
   * @param {Admin} user - The admin user object requesting access to the transactions report.
   * @return {Promise<boolean>} A promise that resolves to a boolean value indicating whether the user has the required permissions.
   */
  async viewTransactionsReport(user: Admin): Promise<boolean> {
    return adminHasPermission(user, TRANSACTION_PERMISSIONS.transactionsReportRead)
  }

  /**
   * Retrieves and verifies the user's permission to view transaction records.
   *
   * @param {Admin} user - The admin user whose permissions are to be checked.
   * @return {Promise<boolean>} A promise that resolves to a boolean indicating whether the user has permission to view transactions.
   */
  async viewUserTransactions(user: Admin): Promise<boolean> {
    return adminHasPermission(user, TRANSACTION_PERMISSIONS.userTransactionsRead)
  }

  /**
   * Retrieves the user transactions report for the specified admin if they have the required permissions.
   *
   * @param {Admin} user - The admin user requesting to view the user transactions report.
   * @return {Promise<boolean>} A promise that resolves to true if the admin has permission to view the report, otherwise false.
   */
  async viewUserTansactionsReport(user: Admin): Promise<boolean> {
    return adminHasPermission(user, TRANSACTION_PERMISSIONS.userTransactionsReportRead)
  }

  /**
   * Determines if the given admin user has permission to view transaction ledger.
   *
   * @param {Admin} user - The admin user whose permissions are being checked.
   * @return {Promise<boolean>} A promise that resolves to true if the user has the 'transaction_ledger.read' permission, otherwise false.
   */
  async viewLedger(user: Admin): Promise<boolean> {
    return adminHasPermission(user, TRANSACTION_PERMISSIONS.transactionLedgerRead)
  }
}
