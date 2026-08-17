import vine from '@vinejs/vine'

/**
 * A validator for creating a service type object. The `createServiceTypeValidator`
 * ensures that the data structure for a service type complies with the defined schema.
 *
 * The schema validates the following fields:
 * - `code`: A required string that is trimmed and must be unique in the 'service_types' table.
 * - `label`: A required string that is trimmed and must be unique in the 'service_types' table.
 * - `description`: An optional string that is trimmed.
 *
 * Compiled using the `vine.create` method, this validator can be used
 * to validate input data for creating service types.
 */
export const createServiceTypeValidator = vine.create(
  vine.object({
    code: vine.string().unique(async (db, value) => {
      const match = await db.from('service_types').where('code', value).first()
      return !match
    }),
    label: vine.string().unique(async (db, value) => {
      const match = await db.from('service_types').where('label', value).first()
      return !match
    }),
    description: vine.string().optional(),
  })
)

export const updateServiceTypeValidator = vine.create(
  vine.object({
    code: vine.string().unique(async (db, value, field) => {
      const match = await db
        .from('service_types')
        .whereNot('id', field.meta.serviceTypeId)
        .where('code', value)
        .first()
      return !match
    }),
    label: vine.string().unique(async (db, value, field) => {
      const match = await db
        .from('service_types')
        .whereNot('id', field.meta.serviceTypeId)
        .where('label', value)
        .first()
      return !match
    }),
    description: vine.string().optional(),
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
export const createServiceTypeValidatorMessage = {
  'code.required': 'Le code est requis',
  'required.required': 'Le nom du type de service est requis',
  'description': 'La description est requis',
  'code.database.unique': 'Code existe déjà',
  'label.database.unique': 'Ce nom existe déjà',
}
