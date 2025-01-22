export interface NewOtp {
  user_id: number
  otp_code: string | null
  expires_at: Date | null
  locked_until?: Date | null
  phone: string | null
  attempts?: number | null
}
