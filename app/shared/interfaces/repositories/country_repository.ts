import Country from '#shared/models/country'

export default abstract class CountryRepository {
  /**
   * Finds and returns a country by its ISO code.
   *
   * @param {string} isoCode - The ISO code of the country to find.
   * @return {Promise<Country | null>} A promise that resolves to the country object if found, or null if no country matches the given ISO code.
   */
  abstract findByIsoCode(isoCode: string): Promise<Country | null>
}
