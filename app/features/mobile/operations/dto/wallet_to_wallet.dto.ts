export interface WalletToWalletRequestDto {
  qrcode: string
  recipient_phone: string
  amount: number
}

export interface WalletToWalletResponseDto {
  message: string
  data: {
    reference: string
    status: 'success' | 'pending' | 'failed'
  }
}
