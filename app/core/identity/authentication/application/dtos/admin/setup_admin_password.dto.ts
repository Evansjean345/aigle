export interface SetupAdminPasswordRequestDto {
  token: string
  password: string
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}
