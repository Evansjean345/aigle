import vine from '@vinejs/vine'
import { InferInput } from '@vinejs/vine/types'

const deviceSchema = vine.object({
  fingerprint_hash: vine.string().trim(),
  device_uid: vine.string().trim(),
  platform: vine.string().trim().optional(),
  brand: vine.string().trim().optional(),
  model: vine.string().trim().optional(),
  os_version: vine.string().trim().optional(),
  app_version: vine.string().trim().optional(),
  is_emulator: vine.boolean(),
  is_rooted: vine.boolean(),
})

const registerSchema = vine.object({
  firstname: vine.string().trim(),
  lastname: vine.string().trim(),
  email: vine.string().trim().email().optional(),
  phone: vine.string().trim(),
  pincode: vine.string().trim().minLength(5).maxLength(5),
  country_id: vine.number().exists(async (db, value) => {
    const row = await db.from('countries').where('id', value).first()
    return !!row
  }),
  deviceInfo: deviceSchema,
})

export const registerValidator = vine.compile(registerSchema)
export type RegisterValidatorType = InferInput<typeof registerSchema>

/**
 * A schema validator for the login process.
 *
 * The `loginValidator` validates the structure and rules of the login payload, ensuring
 * the submitted data conforms to the defined constraints.
 *
 * The schema includes the following fields:
 *
 * - `phone`: A required string that is trimmed of whitespace.
 * - `codepin`: A required string, also trimmed of whitespace, with a fixed length of 5 characters.
 * - `country_id`: A required number. The value must exist in the `countries` database table as validated through an asynchronous database query.
 * - `devicePayload`: An object containing detailed information about the user's device:
 *   - `fingerprint_hash`: A required string, trimmed of whitespace.
 *   - `device_uid`: A required string, trimmed of whitespace.
 *   - `platform`: An optional string, trimmed of whitespace.
 *   - `brand`: An optional string, trimmed of whitespace.
 *   - `model`: An optional string, trimmed of whitespace.
 *   - `os_version`: An optional string, trimmed of whitespace.
 *   - `app_version`: An optional string, trimmed of whitespace.
 *   - `is_emulator`: A required boolean indicating whether the login attempt is from an emulator.
 *   - `is_rooted`: A required boolean indicating whether the device is rooted.
 */
export const loginValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    codepin: vine.string().trim().minLength(5).maxLength(5),
    country_id: vine.number().exists(async (db, value) => {
      const row = await db.from('countries').where('id', value).first()
      return !!row
    }),
    devicePayload: deviceSchema,
  })
)

/**
 * Validator for verifying user account information.
 *
 * This validator ensures that the provided user account data adheres to the following constraints:
 * - `phone`: Must be a string and will be trimmed of any leading or trailing whitespace.
 * - `otp`: Must be a string, trimmed of any leading or trailing whitespace, with a minimum and maximum length of 4 characters.
 * - `country_id`: Must be a number and it is required to exist in the `countries` table in the database.
 */
export const verifyUserAccountValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    otp: vine.string().trim().minLength(4).maxLength(4),
    country_id: vine.number().exists(async (db, value) => {
      const row = await db.from('countries').where('id', value).first()
      return !!row
    }),
  })
)

/**
 * Validator for validating a PIN code input object.
 *
 * The `checkPinValidator` is designed to validate an object containing a
 * single property `pincode`. The validation rules enforced are:
 * - `pincode` must be a string.
 * - Leading and trailing spaces in `pincode` are trimmed.
 * - `pincode` must have an exact length of 5 characters.
 *
 * This validator ensures that the input object conforms to the specified
 * structure and rules. If the validation fails, appropriate errors will
 * be reported.
 */
export const checkPinValidator = vine.compile(
  vine.object({
    pincode: vine.string().trim().minLength(5).maxLength(5),
  })
)

/**
 * A validation schema for checking phone data.
 *
 * The `checkPhoneValidator` variable is a compiled validation schema
 * defined using the `vine` library. It validates an object containing
 * phone and country_id fields.
 *
 * @variable {Object} checkPhoneValidator
 *
 * @property {string} phone
 *  Specifies that the `phone` property must be a trimmed string.
 *
 * @property {number} country_id
 *  Ensures that the `country_id` property exists in the database by
 *  performing an asynchronous check against the `countries` table to
 *  verify the existence of a record with the specified `id`.
 */
export const checkPhoneValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    country_id: vine.number().exists(async (db, value) => {
      const row = await db.from('countries').where('id', value).first()
      return !!row
    }),
  })
)

/**
 * Validator for the forgot password reset functionality.
 *
 * This variable defines the schema and validation rules for the input fields required
 * during the forgot password reset process.
 *
 * Fields:
 * - `phone`: A string field that is trimmed of leading and trailing whitespace.
 * - `otp`: A string field that must be exactly 4 characters long.
 * - `new_pincode`: A string field that is trimmed and must have a length of exactly 5 characters.
 * - `confirm_pincode`: A string field that must match `new_pincode`.
 * - `country_id`: A numeric field that is validated to ensure the existence of a
 *    corresponding country entry in the database using an asynchronous lookup.
 */
export const forgotPasswordResetValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    reset_token: vine.string().trim(),
    new_pincode: vine.string().trim().minLength(5).maxLength(5),
    confirm_pincode: vine.string().trim().sameAs('new_pincode'),
    country_id: vine.number().exists(async (db, value) => {
      const row = await db.from('countries').where('id', value).first()
      return !!row
    }),
  })
)
