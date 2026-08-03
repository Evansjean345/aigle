import vine from '@vinejs/vine'
import { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'

/**
 * Validateurs du catalogue des comptes de collecte.
 *
 * `accountIdentifier` n'est pas modifiable après création : on valide uniquement ce qui peut l'être
 * avec certitude, une règle trop stricte bloquant des comptes légitimes.
 */

/** Mobile money ivoirien : 10 chiffres, indicatif +225 facultatif. */
const MSISDN = /^(?:\+?225)?\d{10}$/

export const createCollectionAccountValidator = vine.compile(
  vine.object({
    label: vine.string().trim().minLength(2).maxLength(120),
    type: vine.enum(Object.values(CollectionAccountType)),
    // Borne de longueur, pas de contrainte de forme : elle attrape la saisie manifestement vide ou
    // tronquée sans présumer d'un format (RIB, numéro de compte, IBAN…).
    // Les bornes s'appliquent AVANT `transform`, donc sur la valeur encore espacée : la limite haute
    // est volontairement large pour ne pas rejeter un RIB saisi par groupes (« CI008 01001 … »),
    // les séparateurs étant retirés juste après.
    accountIdentifier: vine
      .string()
      .trim()
      .minLength(8)
      .maxLength(40)
      .transform((value) => value.replaceAll(' ', '').toUpperCase()),
    accountHolder: vine.string().trim().minLength(2).maxLength(160),
    instructions: vine.string().trim().maxLength(500).optional().nullable(),
    displayOrder: vine.number().min(0).optional(),
  })
)

/**
 * Vérifie que l'identifiant correspond au format attendu pour le type de compte annoncé.
 *
 * Aucun contrôle sur les comptes bancaires : en Côte d'Ivoire l'identifiant communiqué est le plus
 * souvent un RIB ou un numéro de compte, pas un IBAN.
 *
 * @param {CollectionAccountType} type - Type de compte déclaré.
 * @param {string} accountIdentifier - Identifiant normalisé, sans espaces et en majuscules.
 * @returns {boolean} `true` si l'identifiant est acceptable pour ce type.
 */
export function assertIdentifierMatchesType(
  type: CollectionAccountType,
  accountIdentifier: string
): boolean {
  return type === CollectionAccountType.MOBILE_MONEY ? MSISDN.test(accountIdentifier) : true
}

/** Mise à jour : `accountIdentifier` et `type` sont volontairement absents. */
export const updateCollectionAccountValidator = vine.compile(
  vine.object({
    label: vine.string().trim().minLength(2).maxLength(120).optional(),
    accountHolder: vine.string().trim().minLength(2).maxLength(160).optional(),
    instructions: vine.string().trim().maxLength(500).optional().nullable(),
    displayOrder: vine.number().min(0).optional(),
  })
)

export const toggleCollectionAccountValidator = vine.compile(
  vine.object({
    isActive: vine.boolean(),
  })
)
