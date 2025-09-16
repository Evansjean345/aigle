import Country from '#shared/models/country'
import CountryRepository from '#shared/interfaces/repositories/country_repository'

export default class CountryRepositoryImpl implements CountryRepository {
  /**
   * Finds and returns a country by its ISO code.
   *
   * @param {string} isoCode - The ISO code of the country to find.
   * @return {Promise<Object|null>} A promise that resolves to the country object if found, or null if not found.
   */
  async findByIsoCode(isoCode: string): Promise<Country | null> {
    return await Country.findBy('iso_code', isoCode.toUpperCase())
  }
}
