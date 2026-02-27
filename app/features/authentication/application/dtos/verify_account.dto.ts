// HTTP → Use Case input DTO for Verify Account
export interface VerifyAccountRequestDto {
  phone: string
  otp: string
  country_id: number
}
