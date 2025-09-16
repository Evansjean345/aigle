export interface NewUser {
  phone: string
  email: string | null
  firstname: string | null
  lastname: string | null
  password: string
  country_id: number
}

export interface User {
  id: number
  phone: string
  users_uid: string
  email: string | null
  firstname: string | null
  lastname: string | null
  password: string
  country_id: string | null
  status: string | 'active' | 'inactive'
  adresse: string | null
  account_type: string | 'freemium' | 'premium'
  createdAt: Date
  updatedAt: Date
}
