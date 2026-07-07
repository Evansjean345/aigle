import type Country from '#core/catalog/country/domain/models/country'

export default abstract class CountryRepository {
  /**
   * Retrieves a list of all countries from the database.
   *
   * @return {Promise<Array>} A promise that resolves to an array of country objects.
   */
  abstract getCountries(): Promise<Country[]>

  /**
   * Finds and returns a country based on a specified key and value pair.
   *
   * @param {string} key - The key used to search for the country (e.g., "code", "name").
   * @param {any} value - The value corresponding to the key to match.
   * @return {Promise<Country>} A promise that resolves to the country object if found.
   * @throws {Exception} If the country is not found, an exception is thrown with a 404 status and a code of 'COUNTRY_NOT_FOUND'.
   */
  abstract findCountryBy(key: string, value: any): Promise<Country>

  /**
   * Finds and returns a country by its ISO code.
   *
   * @param {string} isoCode - The ISO code of the country to find.
   * @return {Promise<Country | null>} A promise that resolves to the country object if found, or null if no country matches the given ISO code.
   */
  abstract findByIsoCode(isoCode: string): Promise<Country | null>
}
