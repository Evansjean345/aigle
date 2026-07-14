import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

/**
 * Grille **`(segment, level) → limites`** pour les segments ORG (marchand / enterprise) — refactor
 * account-centric, É0 (P22). Les niveaux `particulier` (KYC user) sont gérés ailleurs (existant /
 * back-office) et ne sont PAS touchés ici.
 *
 * Prérequis : migration `add_segment_to_kyc_level` (colonne `segment` + unique `(segment, level)`).
 * Idempotent via `onConflict(['segment','level']).merge()`.
 *
 * ⚠️ VALEURS PLACEHOLDER — à REMPLACER par les vraies limites (back-office) avant prod.
 *    Seules décisions actées : `enterprise` level 2 = **illimité** (`null`) ; `enterprise` level 0 =
 *    KYB non finalisé → **bloqué** (0). Les montants `marchand` level 1 sont provisoires.
 *    Plafonds `null` = ILLIMITÉ (ignorés à la validation).
 */
export default class extends BaseSeeder {
  public async run() {
    const now = new Date()
    const rows = [
      // Marchand — encaisse avec plafonds selon son niveau KYB. ⚠️ montants provisoires.
      {
        segment: 'marchand',
        level: 1,
        single_limit: 500_000,
        daily_limit: 2_000_000,
        monthly_limit: 20_000_000,
        balance_limit: 5_000_000,
        is_active: true,
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
      // Enterprise level 0 — KYB (RCCM/DFE) non finalisé → mouvement bloqué (plafonds 0).
      {
        segment: 'enterprise',
        level: 0,
        single_limit: 0,
        daily_limit: 0,
        monthly_limit: 0,
        balance_limit: 0,
        is_active: true,
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
      // Enterprise level 2 — KYB validé → ILLIMITÉ (null = pas de plafond).
      {
        segment: 'enterprise',
        level: 2,
        single_limit: null,
        daily_limit: null,
        monthly_limit: null,
        balance_limit: null,
        is_active: true,
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
    ]

    await db.table('kyc_level').insert(rows).onConflict(['segment', 'level']).merge()
  }
}
