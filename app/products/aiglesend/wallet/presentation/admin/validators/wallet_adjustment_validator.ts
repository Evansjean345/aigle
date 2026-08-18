import vine from '@vinejs/vine'
import { AdjustmentType, AdjustmentReason } from '#core/money/wallet/domain/enums/wallet_adjustment'
import { walletAdjustmentSortNames } from '#core/money/wallet/domain/types/wallet_adjustment_sorts'
import { minSearchLength } from '#config/app'

const walletAdjustementValidatorSchema = vine.object({
  walletId: vine.number().positive(),
  type: vine.enum(Object.values(AdjustmentType)),
  reason: vine.enum(Object.values(AdjustmentReason)),
  amount: vine.number().min(1),
  comment: vine.string().trim().minLength(10).maxLength(2000),
  transactionReference: vine.string().trim().minLength(1).optional(),
})

export const walletAdjustmentValidator = vine.create(walletAdjustementValidatorSchema)

const walletAdjustementListSchema = vine.object({
  page: vine.number().positive().optional(),
  perPage: vine.number().positive().max(200).optional(),
  walletId: vine.number().positive().optional(),
  /** Compte titulaire du portefeuille ajusté. Pour une organisation, son `organisationId`. */
  accountId: vine.string().trim().uuid().optional(),
  adminId: vine.number().positive().optional(),
  type: vine.enum(Object.values(AdjustmentType)).optional(),
  reason: vine.enum(Object.values(AdjustmentReason)).optional(),
  search: vine.string().trim().minLength(minSearchLength).maxLength(200).optional(),
  sortBy: vine.enum(walletAdjustmentSortNames).optional(),
  order: vine.enum(['asc', 'desc']).optional(),
  minAmount: vine.number().min(0).optional(),
  maxAmount: vine.number().min(0).optional(),
  startDate: vine.string().trim().optional(),
  endDate: vine.string().trim().optional(),
})

export const walletAdjustmentListValidator = vine.create(walletAdjustementListSchema)
