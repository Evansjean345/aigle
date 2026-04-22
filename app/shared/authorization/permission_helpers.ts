import type Admin from '#features/team/domain/models/admin'

/**
 * Checks if the given admin user has a specific permission.
 *
 * @param {Admin} user - The admin user object for which the permission check needs to be performed.
 * @param {string} perm - The permission slug to check against the admin user's permissions.
 * @return {Promise<boolean>} A promise that resolves to true if the admin user has the specified permission, otherwise false.
 */
export async function adminHasPermission(user: Admin, perm: string | string[]): Promise<boolean> {
  await user.load('role', (q) => q.preload('permissions'))

  if (user.role?.slug === 'root') {
    return true
  }

  if (Array.isArray(perm)) {
    return perm.some((p) => user.role?.permissions?.some((permission) => permission.slug === p))
  }

  return user.role?.permissions?.some((p) => p.slug === perm) ?? false
}
