export const SYNC_DEPOSIT_PROVIDERS = ['wave'] as const
export type SyncDepositProvider = (typeof SYNC_DEPOSIT_PROVIDERS)[number]

export function isSyncDepositProvider(providerCode: string): boolean {
  return SYNC_DEPOSIT_PROVIDERS.includes(providerCode as SyncDepositProvider)
}
