import vine from '@vinejs/vine'
import { allowedProviderType } from '#core/catalogs/application/use_cases/providers.use_case'
/**
 * A validator for creating a service type object. The `createServiceTypeValidator`
 * ensures that the data structure for a service type complies with the defined schema.
 *
 * The schema validates the following fields:
 * - `code`: A required string that is trimmed and must be unique in the 'service_types' table.
 * - `label`: A required string that is trimmed and must be unique in the 'service_types' table.
 * - `description`: An optional string that is trimmed.
 *
 * Compiled using the `vine.compile` method, this validator can be used
 * to validate input data for creating service types.
 */
export const createProviderValidator = vine.compile(
  vine.object({
    code: vine.string().unique(async (db, value) => {
      const match = await db.from('providers').where('code', value).first()
      return !match
    }),
    name: vine.string().unique(async (db, value) => {
      const match = await db.from('providers').where('name', value).first()
      return !match
    }),
    type: vine.enum(allowedProviderType),
    logo: vine.string().optional(),
  })
)
/**
 * The `updateProviderValidator` is a compiled validation schema defined using the `vine` validation library.
 * It enforces specific rules for updating provider entities in the system.
 *
 * Properties validated by this schema include:
 *
 * - `code`: A string field that must be unique within the database. The field undergoes a custom async validation
 *   to ensure that the `code` does not conflict with other providers except the one being updated, identified
 *   by the `serviceTypeId` from the metadata.
 *
 * - `label`: A string field that must be unique within the database. Similar to `code`, it undergoes a custom async
 *   validation to prevent conflicts with other providers except the one specified by the `serviceTypeId` in metadata.
 *
 * - `type`: An enum field that must match one of the allowed values defined in `allowedProviderType`.
 *
 * The schema is primarily used to validate input data for updating provider records in the database.
 */
export const updateProviderValidator = vine.compile(
  vine.object({
    code: vine.string().unique(async (db, value, field) => {
      const match = await db
        .from('providers')
        .whereNot('id', field.meta.providerId)
        .where('code', value)
        .first()
      return !match
    }),
    name: vine.string().unique(async (db, value, field) => {
      const match = await db
        .from('providers')
        .whereNot('id', field.meta.providerId)
        .where('name', value)
        .first()
      return !match
    }),
    type: vine.enum(allowedProviderType),
  })
)

/**
 * Object containing validation messages for service type fields.
 *
 * Each property in the object corresponds to a specific validation rule,
 * with the key indicating the rule and the value providing the associated
 * validation message.
 *
 * Properties:
 * - 'code.required': Validation message for when the code field is required.
 * - 'name.required': Validation message for when the name field is required.
 * - 'description': Validation message for when the description field is required.
 */
export const providerValidatorMessage = {
  'code.required': 'Le code est requis',
  'code.database.unique': 'Code existe déjà',
  'name.database.unique': 'Ce nom existe déjà',
  'name.required': 'Le nom du provider est requis',
  'type.enum': "Le type de provider renseigné n'est pas valide",
}
