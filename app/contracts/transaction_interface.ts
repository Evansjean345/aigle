export interface TransactionInterface {
  create(data: any): Promise<any>
  update(data: any): Promise<any>
  get_all_by_user(data: any): Promise<any>
  get_detail_by_user(data: any): Promise<any>
  get_detail_by_uid_or_reference(data: any): Promise<any>
  get_detail_by_reference(data: any): Promise<any>
}
