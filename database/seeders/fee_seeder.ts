import ServiceFee from '#models/service_fee'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    type FeeType = {
      id?: number
      services_type: string
      percentage_fee: number
    }
    const fees: FeeType[] = [
      { id: 1, services_type: 'deposit', percentage_fee: 1.5 },
      { id: 2, services_type: 'transfer', percentage_fee: 1.5 },
      { id: 3, services_type: 'transfer_inter', percentage_fee: 1.5 },
      { id: 4, services_type: 'airtime', percentage_fee: 1.5 },
      { id: 5, services_type: 'passe', percentage_fee: 1.5 },
    ]
    await ServiceFee.updateOrCreateMany('id', fees)
    console.log('fees created successfully')
  }
}
