export interface AuthenticatedProfileResponseDto {
  accountNumber: string
  id: string
  firstname: string
  lastname: string
  identityStatus: 'pending' | 'approved' | 'rejected'
  phone: string
  accountType: string
  picture_url: string | null
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  country: Country
}

interface Country {
  id: number
  name: string
  code: string
  flag: string
}

export interface AuthenticatedProfileAndTokenResponseDto {
  user: AuthenticatedProfileResponseDto
  token: string
  type: 'Bearer'
}
