import type Admin from '#core/team/domain/models/admin'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Vérifie qu'un administrateur détient une permission, ou l'une d'entre elles.
 *
 * Aucun rôle n'est dispensé de la vérification : un compte n'obtient un droit qu'en le détenant.
 * Le rôle `root` passe les gardes parce qu'il porte l'intégralité du catalogue, non parce que le
 * code le reconnaît.
 *
 * @param {Admin} user - L'administrateur dont on vérifie les droits.
 * @param {PermissionDefinition | PermissionDefinition[]} permission - La permission requise, ou un ensemble dont une seule suffit.
 * @return {Promise<boolean>} `true` si le droit est détenu.
 */
export async function adminHasPermission(
  user: Admin,
  permission: PermissionDefinition | PermissionDefinition[]
): Promise<boolean> {
  await user.load('role', (q) => q.preload('permissions'))

  const held = new Set(user.role?.permissions?.map((p) => p.slug) ?? [])
  const required = Array.isArray(permission) ? permission : [permission]

  return required.some((p) => held.has(p.slug))
}
