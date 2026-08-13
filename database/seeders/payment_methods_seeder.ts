import { BaseSeeder } from '@adonisjs/lucid/seeders'
import PaymentMethod from '#core/catalog/catalogs/domain/models/payment_method'

export default class extends BaseSeeder {
  public async run() {
    const methods = [
      { code: 'wallet', label: 'Transfert Local', order: 1 },
      { code: 'mobile-money', label: 'Mobile Money', order: 2 },
      { code: 'bank', label: 'Bank' },
      { code: 'credit-card', label: 'Credit Card' },
    ]

    await PaymentMethod.updateOrCreateMany('code', methods)
  }
}
