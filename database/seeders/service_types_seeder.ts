import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ServiceType from '#core/catalog/catalogs/domain/models/service_type'

export default class extends BaseSeeder {
  public async run() {
    const serviceTypes = [
      { code: 'deposit', label: 'Dépôt' },
      { code: 'transfert', label: 'Transfert' },
      { code: 'inter-reseau', label: 'Inter-réseaux' },
      { code: 'topup', label: 'Airtime' },
      { code: 'checkout', label: 'Paiement marchand' },
    ]

    await ServiceType.updateOrCreateMany('code', serviceTypes)
  }
}
