import { inject } from '@adonisjs/core'
import AirtimeService from './airtime_services.js'
import TransfertInterService from './transfert_inter.js'

@inject()
export default class GatwayService {
  constructor(
    protected airtimeService: AirtimeService,
    protected transfertInterService: TransfertInterService
  ) {}

  // function qui sert de passerelle entre deux services à fin qu'ils communique ensemble
  async operation_gatway(data: any, auth: any) {
    let operation = null
    switch (data.operation_type) {
      case 'airtime':
        operation = await this.airtimeService.airtime_first_step(data, auth)
        break
      case 'transfert_inter':
        operation = await this.transfertInterService.transfert_inter_init_deposit(data, auth)
        break
      default:
        break
    }

    return operation
  }
}
