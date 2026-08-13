import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import Country from '#core/catalog/country/domain/models/country'

/**
 * Référentiel des pays.
 *
 * Les identifiants sont conservés : un utilisateur porte `country_id`, et le décaler renverrait
 * chaque compte vers un autre pays.
 */
export default class extends BaseSeeder {
  async run() {
    const path = app.makePath('database/seeds/countries.json')
    const countries = JSON.parse(await readFile(path, 'utf8'))

    await Country.updateOrCreateMany('id', countries)
  }
}
