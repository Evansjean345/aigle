import Country from '#models/country'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const uniqueKey = 'iso_code'

    try {
      // Chemin vers ton fichier JSON contenant les pays
      // const filePath = join(import.meta.dirname, '../../seeds/countries.json')

      // Lire le fichier JSON
      // const data = await readFile(filePath, 'utf-8')

      // Parser les données JSON
      // const countries = JSON.parse(data)

      // Insérer chaque pays dans la base de données
      await Country.updateOrCreateMany(uniqueKey, [
        {
          name: "Côte d'Ivoire",
          flag: 'https://example.com/flag-ci.png',
          iso_code: 'CI',
          currency_code: 'XOF',
          currency_symbol: '₣',
          phone_code: '+225',
        },
        {
          name: 'France',
          flag: 'https://example.com/flag-fr.png',
          iso_code: 'FR',
          currency_code: 'EUR',
          currency_symbol: '€',
          phone_code: '+33',
        },
        {
          name: 'États-Unis',
          flag: 'https://example.com/flag-us.png',
          iso_code: 'US',
          currency_code: 'USD',
          currency_symbol: '$',
          phone_code: '+1',
        },
        {
          name: 'Canada',
          flag: 'https://example.com/flag-ca.png',
          iso_code: 'CA',
          currency_code: 'CAD',
          currency_symbol: '$',
          phone_code: '+1',
        },
      ])

      console.log('Countries successfully seeded!')
    } catch (error) {
      console.error('Error seeding countries:', error)
    }
  }
}
