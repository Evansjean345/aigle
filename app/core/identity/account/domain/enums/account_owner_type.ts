/**
 * Nature du propriétaire d'un compte.
 * - USER : compte personnel (consumer) ; owner_ref = users_uid.
 * - ORGANISATION : compte business ; owner_ref = organisation_id.
 */
export enum AccountOwnerType {
  USER = 'user',
  ORGANISATION = 'organisation',
}
