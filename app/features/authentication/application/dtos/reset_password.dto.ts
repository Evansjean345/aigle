// HTTP → Use Case input DTO for Reset Password
export interface ResetPasswordRequestDto {
  phone: string
  reset_token: string
  new_pincode: string
  confirm_pincode: string
  country_id: number
}
