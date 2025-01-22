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

    for (const operatorData of operators) {
      await Operator.create(operatorData)
    }

    console.log('Opérateurs insérés avec succès')

    const services = [
      { name: 'Dépôt', payment_mode: 'Mobile Money', fee: 2.0 },
      { name: 'Transfert', payment_mode: 'Mobile Money', fee: 2.5 },
      { name: 'Transfert inter-opérateur', payment_mode: 'Mobile Money', fee: 3.0 },
      { name: 'Facture', payment_mode: 'Bank', fee: 2.0 },
      { name: 'Achat de pass', payment_mode: 'Card', fee: 1.5 },
    ]

    for (const serviceData of services) {
      await Service.updateOrCreate(
        { name: serviceData.name, paymentMode: serviceData.payment_mode },
        { name: serviceData.name, paymentMode: serviceData.payment_mode, fee: serviceData.fee }
      )
    }

    console.log('Services insérés avec succès');

  }
}
