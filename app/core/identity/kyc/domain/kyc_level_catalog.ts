import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'

/** Plafonds d'un palier. `null` vaut **illimité**, et non zéro. */
export interface KycLevelLimits {
  singleLimit: number | null
  dailyLimit: number | null
  monthlyLimit: number | null
  balanceLimit: number | null
}

/** Un palier : ce qu'il identifie, ce qu'il signifie, et ce qu'il vaut à sa création. */
export interface KycLevelDefinition {
  segment: AccountSegment
  level: number
  /** Ce que le palier autorise, en une expression — « Identité vérifiée ». */
  title: string
  /** Comment un compte l'atteint — « Après approbation du dossier d'identité ». */
  reachedBy: string
  defaults: KycLevelLimits
}

/**
 * Les paliers qui existent, et ce qu'ils signifient.
 *
 * `kyc:levels:sync` téléverse ce catalogue en base. Le back-office en ajuste les montants.
 *
 * ⚠️ Les montants sont provisoires : ils ne valent qu'à la création d'un palier, les vraies limites
 * se règlent au back-office.
 */
export const KYC_LEVEL_CATALOG: readonly KycLevelDefinition[] = [
  {
    segment: AccountSegment.PARTICULIER,
    level: 1,
    title: 'Compte non vérifié',
    reachedBy: "Attribué à l'inscription, avant toute vérification d'identité",
    defaults: {
      singleLimit: 100_000,
      dailyLimit: 200_000,
      monthlyLimit: 500_000,
      balanceLimit: 200_000,
    },
  },
  {
    segment: AccountSegment.PARTICULIER,
    level: 2,
    title: 'Identité vérifiée',
    reachedBy: "Après approbation du dossier d'identité",
    defaults: {
      singleLimit: 500_000,
      dailyLimit: 2_000_000,
      monthlyLimit: 2_000_000,
      balanceLimit: 3_000_000,
    },
  },
  {
    segment: AccountSegment.ORGANISATION,
    level: 0,
    title: 'En attente de vérification',
    reachedBy: "Attribué à la création : les mouvements restent bloqués jusqu'à l'approbation",
    // Zéro et non `null` : le compte est bloqué tant que son dossier n'est pas approuvé.
    defaults: { singleLimit: 0, dailyLimit: 0, monthlyLimit: 0, balanceLimit: 0 },
  },
  {
    segment: AccountSegment.ORGANISATION,
    level: 1,
    title: 'Encaissement ouvert',
    reachedBy: 'Attribué à la création : un marchand ne passe aucune vérification',
    defaults: {
      singleLimit: 500_000,
      dailyLimit: 2_000_000,
      monthlyLimit: 20_000_000,
      balanceLimit: 5_000_000,
    },
  },
  {
    segment: AccountSegment.ORGANISATION,
    level: 2,
    title: 'Entreprise vérifiée',
    reachedBy: "Après approbation du dossier d'entreprise",
    defaults: { singleLimit: null, dailyLimit: null, monthlyLimit: null, balanceLimit: null },
  },
]

/**
 * Rend la définition d'un palier.
 *
 * @param {string} segment - Segment du compte.
 * @param {number} level - Rang du palier.
 * @returns {KycLevelDefinition | null} La définition, ou `null` pour un couple qu'aucune règle ne
 *   prévoit.
 */
export function levelDefinitionOf(segment: string, level: number): KycLevelDefinition | null {
  return (
    KYC_LEVEL_CATALOG.find(
      (definition) => definition.segment === segment && definition.level === level
    ) ?? null
  )
}
