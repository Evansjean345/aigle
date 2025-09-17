// HTTP → Use Case input DTO for Register
export interface RegisterRequestDto {
  phone: string
  firstname: string
  lastname: string
  email?: string
  pincode: string
  iso_code: string
}
