import { Exception } from '@adonisjs/core/exceptions'

export const uniqueID = (length: number): string => {
  let randomID = ''

  // Générer un numéro aléatoire composé uniquement de chiffres
  for (let i = 0; i < length; i++) {
    randomID += Math.floor(Math.random() * 10) // Génère un chiffre aléatoire entre 0 et 9
  }

  return randomID
}

/**
 * Removes all non-numeric characters from a given phone number string.
 *
 * This function takes a phone number as input and returns a new string
 * containing only the digits of the original phone number, stripping out
 * any other characters such as spaces, dashes, or brackets.
 *
 * @param {string} phone_number - The phone number string to be cleaned.
 * @return {string} - A string containing only numeric characters extracted from the input.
 */
export const cleanPhoneNumber = (phone_number: string): string => {
  if (!phone_number || typeof phone_number !== 'string') {
    return ''
  }
  return phone_number.replace(/[^0-9]/g, '')
}

/**
 * Asynchronously concatenates a phone number with the country code prefix.
 *
 * This function takes a country identifier and a phone number, then retrieves
 * the country information from the database. It formats the provided phone
 * number and appends the country's dialing code to the phone number.
 * If the country is not found, an exception is thrown.
 *
 * @param countryPhonecode
 * @param {string} phone - The phone number to be concatenated with the country code.
 * @returns {Promise<string>} A promise that resolves to the formatted phone number string,
 *                            including the country dialing code.
 * @throws {Exception} Throws an exception if the country is not found.
 */
export const concartPhoneNumber = (countryPhonecode: string, phone: string): string => {
  if (!phone || typeof phone !== 'string') {
    throw new Exception('Le numéro de téléphone est requis et doit être une chaîne de caractères', {
      status: 400,
      code: 'E_INVALID_PHONE_NUMBER',
    })
  }

  if (!countryPhonecode || typeof countryPhonecode !== 'string') {
    throw new Exception('Le code pays est requis et doit être une chaîne de caractères', {
      status: 400,
      code: 'E_INVALID_COUNTRY_CODE',
    })
  }

  const phoneNumberFormatted = cleanPhoneNumber(phone)

  // Vérifier si le numéro commence déjà par l'indicatif pays
  if (phoneNumberFormatted.startsWith(countryPhonecode)) {
    return phoneNumberFormatted
  }

  return `${countryPhonecode}${phoneNumberFormatted}`
}
/**
 * Normalizes a phone number based on the provided or default country code.
 *
 * The function trims whitespace from the input phone number and removes spaces. It normalizes the phone number
 * by handling cases such as:
 * - If the phone number starts with a "+" or "00", the corresponding prefix is removed.
 * - If the phone number starts with the default or provided country code and meets the length requirements, it remains unchanged.
 * - If the phone number starts with "0", the default or provided country code is prefixed to the phone number.
 * - If the phone number meets length requirements (8 to 10 digits) but does not start with "0", the default or provided
 *   country code is prefixed to the phone number.
 *
 * @param {string} rawPhone - The raw phone number input to be normalized.
 * @param {string} [defaultCountryCode='225'] - Optional parameter for the default country code. Defaults to '225' if not provided.
 * @returns {string} The normalized phone number as a string.
 */
export const normalizePhone = (rawPhone: string, defaultCountryCode: string = '225'): string => {
  let phone = rawPhone.trim().replace(/\s+/g, '') // supprimer espaces

  if (phone.startsWith('+')) return phone.substring(1)
  if (phone.startsWith('00')) return phone.substring(2)

  if (/^\d{11,15}$/.test(phone) && phone.startsWith(defaultCountryCode)) return phone

  if (/^\d{8,10}$/.test(phone)) return `${defaultCountryCode}${phone}`

  return phone
}
