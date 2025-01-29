import Operator from '#models/operator'
import Service from '#models/service'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    const operators = [
      { name: 'Orange', poucentage_service_fee: 1, payment_mode: 'Mobile Money' },

      { name: 'Wave', poucentage_service_fee: 1, payment_mode: 'Mobile Money' },

      { name: 'Moov', poucentage_service_fee: 1, payment_mode: 'Mobile Money' },

      { name: 'MTN', poucentage_service_fee: 1, payment_mode: 'Mobile Money' },
      { name: 'Visa', poucentage_service_fee: 1, payment_mode: 'Card' },
      { name: 'MasterCard', poucentage_service_fee: 1, payment_mode: 'Card' },
      { name: 'Bank', poucentage_service_fee: 1, payment_mode: 'Bank' },
    ]

    // for (const operatorData of operators) {
    //   await Operator.create(operatorData)
    // }

    console.log('Opérateurs insérés avec succès')

    type ServiceType = {
      id?: number
      name: string
      fees: number
    }

    const services: ServiceType[] = [
      { id: 1, name: 'Dépôt', fees: 2.0 },
      { id: 2, name: 'Transfert', fees: 2.5 },
      { id: 3, name: 'Transfert inter-opérateur', fees: 3.0 },
      { id: 4, name: 'Aitime', fees: 2.0 },
      { id: 5, name: 'Data', fees: 2.0 },
      { id: 6, name: 'Facture', fees: 2.0 },
    ]
    await Service.updateOrCreateMany('id', services)

    console.log('Services insérés avec succès')
  }
}
