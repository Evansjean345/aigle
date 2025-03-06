import Operator from '#models/operator'
import OperatorFee from '#models/operator_fee'
import Service from '#models/service'
import ServiceFee from '#models/service_fee'
import TypePayment from '#models/type_payment'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    // createion des type de payement
    const type = [
      { libele: 'mobile money', id: 1 },
      { libele: 'wallet', id: 2 },
      { libele: 'carte prépayé', id: 3 },
      { libele: 'bank', id: 4 },
    ]

    let typePayment = await TypePayment.updateOrCreateMany('id', type)

    console.log('type de payement insérés avec succès')

    // creattion des operateur dun type de payement
    const operatorData = [
      { name: 'aigle', type_payments_id: 2, id: 1 },
      { name: 'Orange', type_payments_id: 1, id: 2 },
      { name: 'Wave', type_payments_id: 1, id: 3 },
      { name: 'Moov', type_payments_id: 1, id: 4 },
      { name: 'MTN', type_payments_id: 1, id: 5 },
      { name: 'Visa', type_payments_id: 3, id: 6 },
      { name: 'MasterCard', type_payments_id: 3, id: 7 },
      { name: 'Bank', type_payments_id: 4, id: 8 },
    ]

    let operators = await Operator.updateOrCreateMany('id', operatorData)

    console.log('operateur insérés avec succès')

    // creation des services
    type ServiceType = {
      id?: number
      name: string
    }

    const services: ServiceType[] = [
      { id: 1, name: 'dépôt' },
      { id: 2, name: 'transfert' },
      { id: 3, name: 'transfert inter-opérateur' },
      { id: 4, name: 'aitime' },
      { id: 5, name: 'data' },
      { id: 6, name: 'facture' },
      { id: 7, name: 'virement' },
    ]

    await Service.updateOrCreateMany('id', services)

    console.log('services insérés avec succès')

    // creation des frais de service par services
    const fees: any = [
      { id: 1, services_id: 1, services_type: 'deposit', percentage_fee: 1.5 },
      { id: 2, services_id: 2, services_type: 'transfer', percentage_fee: 1.5 },
      { id: 3, services_id: 3, services_type: 'transfer_inter', percentage_fee: 1.5 },
      { id: 4, services_id: 4, services_type: 'airtime', percentage_fee: 1.5 },
      { id: 4, services_id: 5, services_type: 'data', percentage_fee: 1.5 },
      { id: 5, services_id: 6, services_type: 'facture', percentage_fee: 1.5 },
      { id: 6, services_id: 7, services_type: 'virement', percentage_fee: 1.5 },
    ]
    await ServiceFee.updateOrCreateMany('id', fees)
    console.log('services fees insérés avec succès')

    let globalId = 0
    for (const service of services) {
      const operatorFee = []
      operatorData.forEach((element, index) => {
        operatorFee.push({
          id: globalId++,
          operators_id: element.id,
          services_id: service?.id,
          operator_type: element.name,
          percentage_fee: 1.5,
        })
      })
      await OperatorFee.updateOrCreateMany('id', operatorFee)
    }
    console.log('operator fees insérés avec succès')
  }
}
