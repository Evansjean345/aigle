import CompanyContact from '#core/catalogs/domain/models/company_contact'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    await CompanyContact.updateOrCreate(
      { type: 'phone' },
      { value: '+221338000000', isActive: true }
    )
    await CompanyContact.updateOrCreate(
      { type: 'whatsapp' },
      { value: '+221770000000', isActive: true }
    )
    await CompanyContact.updateOrCreate(
      { type: 'email' },
      { value: 'contact@aiglesend.com', isActive: true }
    )
  }
}
