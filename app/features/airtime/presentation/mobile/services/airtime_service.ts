import { inject } from '@adonisjs/core'
import { makeRequest } from '../../../../helpers/http_helpers.js'
import env from '#start/env'

@inject()
export default class MobileAirtimeService {
  /**
   * Fetches a list of countries where airtime services are available.
   *
   * @return {Promise<>} A promise that resolves to an object containing the data of available airtime countries.
   * @throws {Error} If the request fails or any error occurs during execution.
   */
  async getAirtimeCountries(): Promise<any> {
    try {
      const response = await makeRequest({
        uri: env.get('API_AIRTIME_COUNTRY_URL')!!,
        method: 'get',
        data: '',
      })
      return response.data
    } catch (error) {
      console.log('response error')
      console.log(error)
      throw new Error(error)
    }
  }

  /**
   * Fetches the list of Artimes operators for a given country.
   *
   * @param {string} country_code - The ISO 3166-1 alpha-2 country code.
   * @param queries
   * @return {Promise<any>} A promise that resolves to the fetch response containing the operators.
   */
  async getCountryOperators(
    country_code: string,
    queries: Record<string, string | number | boolean>
  ): Promise<any> {
    const basePath = `${env.get('API_AIRTIME_COUNTRY_URL')}/${country_code}/operators`

    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(queries || {})) {
      searchParams.append(key, String(value))
    }

    const uri = searchParams.toString() ? `${basePath}?${searchParams.toString()}` : basePath

    const response = await makeRequest({
      uri,
      method: 'get',
    })

    return response.data
  }

  /**
   * Fetches available bundles for a specific operator in a given country.
   *
   * @param {string} country_code - The ISO code of the country for which bundles are to be fetched.
   * @param {string} operator_id - The unique identifier of the operator within the specified country.
   * @return {Promise<any>} A promise that resolves with the data containing the available bundles.
   */
  async getBundles(country_code: string, operator_id: string): Promise<any> {
    const uri = `${env.get('API_AIRTIME_COUNTRY_URL')}/${country_code}/operators/${operator_id}/bundles`

    const response = await makeRequest({
      uri,
      method: 'get',
    })

    return response.data
  }
}
