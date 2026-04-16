/**
 * DTO pour le resume transactionnel d'un device.
 */
export class DeviceTransactionSummaryDto {
  declare deviceId: string
  declare fingerprintHash: string
  declare period: {
    from: string
    to: string
  }
  declare totals: {
    transactionCount: number
    totalVolume: number
    totalFees: number
    successCount: number
    failedCount: number
    pendingCount: number
    successRate: number
    vpnTransactionCount: number
  }
  declare byOperationType: {
    type: string
    count: number
    volume: number
  }[]
  declare accountBreakdown: {
    userId: string
    phone: string
    fullname: string
    transactionCount: number
    totalVolume: number
    lastTransactionAt: string | null
  }[]
}

/**
 * DTO pour une transaction dans la liste par device.
 */
export class DeviceTransactionListItemDto {
  declare transactionUid: string
  declare reference: string
  declare amount: number
  declare fees: number
  declare totalAmount: number
  declare operationType: string
  declare direction: string
  declare status: string
  declare description: string | null
  declare createdAt: string
  declare user: {
    userId: string
    phone: string
    fullname: string
  }
  declare securityContext: {
    ipAddress: string
    countryCode: string | null
    city: string | null
    isVpn: boolean
  }
}
