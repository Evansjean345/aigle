import { BaseSeeder } from '@adonisjs/lucid/seeders'
import PaymentMethod from '#shared/models/payment_method'

export default class extends BaseSeeder {
  public async run() {
    const methods = [
      { code: 'mobile_money', label: 'Mobile Money' },
      { code: 'bank', label: 'Bank' },
      { code: 'credit-card', label: 'Credit Card' },
    ]

    await PaymentMethod.updateOrCreateMany('code', methods)
  }
}
