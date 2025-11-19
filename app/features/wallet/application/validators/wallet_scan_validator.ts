import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

const schema = vine.object({
  qrcode: vine.string(),
})

export const walletScanValidator = vine.compile(schema)
export type WalletScanValidator = Infer<typeof schema>
