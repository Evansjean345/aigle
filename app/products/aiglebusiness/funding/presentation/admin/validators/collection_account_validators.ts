import vine from '@vinejs/vine'
import { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'

/**
 * Validateurs du catalogue des comptes de collecte (F1).
 *
 * ⚠️ Le format de `accountIdentifier` est le **dernier contrôle automatique** avant qu'un marchand
 * verse des centaines de milliers de francs : l'identifiant est **immuable après création** (R-D6),
 * une faute de frappe ne se corrige donc pas — elle se désactive et se recrée. On valide strictement.
 */

/** Mobile money CI : 10 chiffres, éventuellement précédés de l'indicatif. */
const MSISDN = /^(?:\+?225)?\d{10}$/
/** IBAN : 2 lettres pays + 2 clés + 11 à 30 caractères alphanumériques. */
const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/

export const createCollectionAccountValidator = vine.compile(
  vine.object({
    label: vine.string().trim().minLength(2).maxLength(120),
    type: vine.enum(Object.values(CollectionAccountType)),
    accountIdentifier: vine
      .string()
      .trim()
      .transform((value) => value.replaceAll(' ', '').toUpperCase()),
    accountHolder: vine.string().trim().minLength(2).maxLength(160),
    instructions: vine.string().trim().maxLength(500).optional().nullable(),
    displayOrder: vine.number().min(0).optional(),
  })
)

/**
 * Vérifie que l'identifiant correspond bien au **type** annoncé. Vine ne permet pas simplement une
 * règle conditionnelle inter-champs ici, on l'exprime donc explicitement — et on la garde côté
 * présentation, car c'est une contrainte de **saisie**, pas une règle métier.
 */
export function assertIdentifierMatchesType(
  type: CollectionAccountType,
  accountIdentifier: string
): boolean {
  return type === CollectionAccountType.MOBILE_MONEY
    ? MSISDN.test(accountIdentifier)
    : IBAN.test(accountIdentifier)
}

/** Mise à jour : `accountIdentifier` et `type` sont **absents par conception** (R-D6). */
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
