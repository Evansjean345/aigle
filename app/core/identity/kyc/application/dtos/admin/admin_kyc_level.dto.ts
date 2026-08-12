import type KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import { meaningOfLevel } from '#core/identity/kyc/domain/verification_requirements'

/**
 * Contrats de service des paliers de vérification.
 *
 * Ce que le service reçoit et ce qu'il rend, sans modèle ORM : les consommateurs vivent hors du
 * contexte identity.
 */

// ── Command (input service) ─────────────────────────────────────────

/**
 * Montants ajustables d'un palier.
 *
 * Ni `segment` ni `level` : le couple identifie le palier et porte sa signification en code — le
 * déplacer changerait les plafonds des comptes qui s'y rattachent sans décision les concernant.
 *
 * Un montant `null` signifie **illimité**.
 */
export interface UpdateKycLevelCommand {
  singleLimit?: number | null
  dailyLimit?: number | null
  monthlyLimit?: number | null
  balanceLimit?: number | null
}

// ── Result (output service) ─────────────────────────────────────────

/**
 * Niveau KYC et ses plafonds, projeté hors du contexte identity.
 *
 * Un plafond `null` signifie illimité.
 */
export interface KycLevelResult {
  id: number
  /** Grille à laquelle ce palier appartient : c'est `(segment, level)` qui l'identifie, pas `level`. */
  segment: string
  level: number
  /** Ce que le palier autorise, tel que le catalogue de vérification le définit. */
  title: string | null
  /** Comment un compte atteint ce palier. */
  reachedBy: string | null
  singleLimit: number | null
  dailyLimit: number | null
  monthlyLimit: number | null
  balanceLimit: number | null
  isActive: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export const toKycLevelResult = (kycLevel: KycLevel): KycLevelResult => ({
  id: kycLevel.id,
  segment: kycLevel.segment,
  level: kycLevel.level,
  // La signification vient du catalogue, jamais de la base : c'est en code qu'un palier prend son
  // sens, et le back-office l'affiche sans le décider.
  title: meaningOfLevel(kycLevel.segment, kycLevel.level)?.title ?? null,
  reachedBy: meaningOfLevel(kycLevel.segment, kycLevel.level)?.reachedBy ?? null,
  singleLimit: kycLevel.singleLimit,
  dailyLimit: kycLevel.dailyLimit,
  monthlyLimit: kycLevel.monthlyLimit,
  balanceLimit: kycLevel.balanceLimit,
  isActive: kycLevel.isActive,
  isArchived: kycLevel.isArchived,
  createdAt: kycLevel.createdAt?.toISO() || '',
  updatedAt: kycLevel.updatedAt?.toISO() || '',
})
