export interface CreateAdminRequestDto {
  firstname: string
  lastname: string
  email: string
  roleId?: number
}

export interface UpdateAdminRequestDto {
  firstname?: string
  lastname?: string
  email?: string
  roleId?: number
  isActive?: boolean
}

export interface AdminResponseDto {
  id: number
  firstname: string
  lastname: string
  email: string
  role?: {
    id: number
    slug: string
    name: string
    permissions: string[]
  }
  isActive: boolean
}

export interface PaginationMeta {
  total: number
  currentPage: number
  lastPage: number
  firstPage: number
  perPage: number
}

export interface PaginatedAdminResponseDto {
  data: AdminResponseDto[]
  meta: PaginationMeta
}
