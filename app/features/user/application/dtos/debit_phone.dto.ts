export interface DebitPhoneResponseDto {
  id: number
  phone: string
  label: string | null
  is_verified: boolean
  provider: {
    id: number
    code: string
    logo: string | null
  }
}
