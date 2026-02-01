import vine from '@vinejs/vine'

/**
 * A validator for creating and validating application version inputs.
 *
 * The `createAppVersionValidator` enforces the following structure:
 * - `deviceType`: Specifies the type of device. Must be either 'ios' or 'android'.
 * - `versionNumber`: A required string representing the application version number.
 * - `minVersion`: A required string specifying the minimum supported version.
 * - `criticalUpdate`: An optional boolean indicating whether the update is critical.
 * - `releaseDate`: An optional string representing the release date of the version.
 * - `downloadUrl`: An optional, nullable string containing a valid URL for downloading the version.
 * - `changelog`: An optional, nullable string detailing the changes in the version.
 */
export const createAppVersionValidator = vine.compile(
  vine.object({
    deviceType: vine.enum(['ios', 'android']),
    versionNumber: vine.string(),
    minVersion: vine.string(),
    criticalUpdate: vine.boolean().optional(),
    releaseDate: vine.string().optional(),
    downloadUrl: vine.string().url().optional().nullable(),
    changelog: vine.string().optional().nullable(),
  })
)

/**
 * Validateur pour la mise à jour d'une version (Admin)
 */
export const updateAppVersionValidator = vine.compile(
  vine.object({
    deviceType: vine.enum(['ios', 'android']).optional(),
    versionNumber: vine.string().optional(),
    minVersion: vine.string().optional(),
    criticalUpdate: vine.boolean().optional(),
    releaseDate: vine.string().optional(),
    downloadUrl: vine.string().url().optional().nullable(),
    changelog: vine.string().optional().nullable(),
  })
)
