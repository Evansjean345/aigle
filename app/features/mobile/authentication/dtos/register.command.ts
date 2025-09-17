// Use Case input (write) for Register
export interface RegisterCommand {
  phone: string
  firstName: string
  lastName: string
  email?: string
  pincode: string
  isoCode: string
}
