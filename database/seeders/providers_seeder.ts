import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Provider from '#core/catalog/catalogs/domain/models/provider'

export default class extends BaseSeeder {
  public async run() {
    const providers = [
      { code: 'orange', name: 'Orange', type: 'mobile_money' },
      { code: 'moov', name: 'Moov', type: 'mobile_money' },
      { code: 'wave', name: 'Wave', type: 'mobile_money' },
      { code: 'mtn', name: 'MTN', type: 'mobile_money' },
      { code: 'aigle', name: 'Aigle', type: 'bank' },
    ] as const

    await Provider.updateOrCreateMany('code', providers as any)
  }
}
