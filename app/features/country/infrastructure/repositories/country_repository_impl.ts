import { Exception } from '@adonisjs/core/exceptions'
import Country from '#features/country/domain/models/country'
import type CountryRepository from '#features/country/domain/interfaces/country_repository'

export default class CountryRepositoryImpl implements CountryRepository {
  /**
   * Retrieves a list of all countries from the database.
   *
   * @return {Promise<Array>} A promise that resolves to an array of country objects.
   */
  async getCountries(): Promise<Country[]> {
    return Country.query().orderBy('name', 'asc')
  }

  /**
   * Finds and returns a country by its ISO code.
   *
   * @param {string} isoCode - The ISO code of the country to find.
   * @return {Promise<Object|null>} A promise that resolves to the country object if found, or null if not found.
   */
  async findByIsoCode(isoCode: string): Promise<Country | null> {
    return await Country.findBy('iso_two', isoCode.toUpperCase())
  }

  /**
   * Finds and returns a country based on a specified key and value pair.
   *
   * @param {string} key - The key used to search for the country (e.g., "code", "name").
   * @param {any} value - The value corresponding to the key to match.
   * @return {Promise<Country>} A promise that resolves to the country object if found.
   * @throws {Exception} If the country is not found, an exception is thrown with a 404 status and a code of 'COUNTRY_NOT_FOUND'.
   */
  async findCountryBy(key: string, value: any): Promise<Country> {
    const country = await Country.findBy(key, value)

    if (!country) {
      throw new Exception("Ce pays n'existe pas", {
        status: 400,
        code: 'COUNTRY_NOT_FOUND',
      })
    }

    return country
  }
}
