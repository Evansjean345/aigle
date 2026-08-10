import { type KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'
import type KycLevel from '#core/identity/kyc/domain/models/kyc_level'

/**
 * Contrats de service des niveaux KYC.
 *
 * Ce que le service reçoit et ce qu'il rend, sans modèle ORM : les consommateurs vivent hors du
 * contexte identity.
 */

// ── Command (input service) ─────────────────────────────────────────

export interface CreateKycLevelCommand {
  level: KycLevelState
  singleLimit: number
  dailyLimit: number
  monthlyLimit: number
  balanceLimit: number
  isActive?: boolean
  isArchived?: boolean
}

export interface UpdateKycLevelCommand {
  level?: KycLevelState
  singleLimit?: number
  dailyLimit?: number
  monthlyLimit?: number
  balanceLimit?: number
  isActive?: boolean
  isArchived?: boolean
}

// ── Result (output service) ─────────────────────────────────────────

/**
 * Niveau KYC et ses plafonds, projeté hors du contexte identity.
 *
 * Un plafond `null` signifie illimité.
 */
export interface KycLevelResult {
  id: number
  level: number
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
  level: kycLevel.level,
  singleLimit: kycLevel.singleLimit,
  dailyLimit: kycLevel.dailyLimit,
  monthlyLimit: kycLevel.monthlyLimit,
  balanceLimit: kycLevel.balanceLimit,
  isActive: kycLevel.isActive,
  isArchived: kycLevel.isArchived,
  createdAt: kycLevel.createdAt?.toISO() || '',
  updatedAt: kycLevel.updatedAt?.toISO() || '',
})
