export interface OperationUser {
  usersUid: string
  phone: string
  firstname: string
  lastname: string
  countryId: number
}

export interface OperationWallet {
  id: number
  walletsUid: string
  userId: string
  balance: number
  currencySymbol: string | undefined
}

export interface OperationServiceType {
  id: number
  code: string
  name: string
}
