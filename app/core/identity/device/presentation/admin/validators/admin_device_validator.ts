import vine from '@vinejs/vine'

export const adminDeviceListValidator = vine.create(
  vine.object({
    minAccounts: vine.number().min(0).optional(),
    isEmulator: vine
      .string()
      .in(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    isRooted: vine
      .string()
      .in(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    hasVpn: vine
      .string()
      .in(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    platform: vine.enum(['ios', 'android']).optional(),
    search: vine.string().trim().minLength(1).optional(),
    sortBy: vine.enum(['accountCount', 'lastSeenAt', 'createdAt']).optional(),
    order: vine.enum(['asc', 'desc']).optional(),
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(100).optional(),
  })
)

export const adminDeviceAccountsValidator = vine.create(
  vine.object({
    status: vine.enum(['active', 'all']).optional(),
  })
)

export const deviceTransactionSummaryValidator = vine.create(
  vine.object({
    from: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
)

export const deviceTransactionsListValidator = vine.create(
  vine.object({
    userId: vine.string().trim().optional(),
    operationType: vine
      .enum(['deposit', 'transfert', 'wallet_transfert', 'inter_reseau'])
      .optional(),
    status: vine.enum(['pending', 'success', 'failed']).optional(),
    startDate: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    isVpn: vine
      .string()
      .in(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(100).optional(),
  })
)
