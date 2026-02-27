export interface RegisterRequestDto {
  phone: string
  firstname: string
  lastname: string
  email?: string
  pincode: string
  country_id: number
}

export interface RegisterResponseDto {
  message: string
  phone: string
}
