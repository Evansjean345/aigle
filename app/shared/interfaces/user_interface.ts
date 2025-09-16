export interface UserInterface {
  id: number
  email: string
  phone: string
  first_name: string
  last_name: string
  status: string
  is_verified: boolean
  created_at: Date
  updated_at: Date
}

export interface CreateUserData {
  email: string
  phone: string
  first_name: string
  last_name: string
  password: string
}

export interface UpdateUserData {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  status?: string
  is_verified?: boolean
}
