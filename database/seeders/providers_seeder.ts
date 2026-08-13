import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Provider from '#core/catalog/catalogs/domain/models/provider'

export default class extends BaseSeeder {
  public async run() {
    const providers = [
      { code: 'orange', name: 'Orange', type: 'mobile-money' },
      { code: 'moov', name: 'Moov', type: 'mobile-money' },
      { code: 'wave', name: 'Wave', type: 'mobile-money' },
      { code: 'mtn', name: 'MTN', type: 'mobile-money' },
      { code: 'aigle', name: 'Aigle', type: 'bank' },
    ] as const

    await Provider.updateOrCreateMany('code', providers as any)
  }
}
