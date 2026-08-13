import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'

/** Palier d'organisation correspondant au palier du compte. */
const LEVEL_OF_ACCOUNT: Record<number, OrganisationLevel> = {
  0: OrganisationLevel.LEVEL_0,
  1: OrganisationLevel.LEVEL_1,
  2: OrganisationLevel.LEVEL_2,
}

/**
 * Traduit le palier du compte en vocabulaire business.
 *
 * Une organisation dont le compte n'est pas encore ouvert vaut `LEVEL_0`, celui qui bloque les
 * mouvements.
 *
 * @param {number | null} [accountLevel] - Palier du compte, absent tant qu'il n'est pas ouvert.
 * @returns {OrganisationLevel} Le palier business correspondant.
 */
export function organisationLevelOf(accountLevel?: number | null): OrganisationLevel {
  if (accountLevel === null || accountLevel === undefined) return OrganisationLevel.LEVEL_0

  return LEVEL_OF_ACCOUNT[accountLevel] ?? OrganisationLevel.LEVEL_0
}
