export interface TransactionInterface {
  depot(amount: number, phoneNumber: string): Promise<any>
  transfert(amount: number, fromNumber: string, toNumber: string): Promise<any>
}
