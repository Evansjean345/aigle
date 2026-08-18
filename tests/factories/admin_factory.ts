import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import Admin from '#core/team/domain/models/admin'
import Role from '#core/team/domain/models/role'
import Permission from '#core/team/domain/models/permission'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

/**
 * Reconstruit la table des permissions à l'image de `ADMIN_PERMISSION_CATALOG'.
 *
 * Reproduit `node ace permissions:sync` : la table ne contient que ce que l'agrégat déclare. À
 * appeler dans le setup d'un test de garde, sinon les lignes déjà présentes en base masqueraient un
 * catalogue de feature oublié dans l'agrégat.
 *
 * @returns {Promise<void>} Une fois la table reconstruite.
 */
export async function syncAdminPermissions(): Promise<void> {
  await Permission.query().delete()
  await Permission.createMany(
    ADMIN_PERMISSION_CATALOG.map((definition) => ({
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
    }))
  )
}

/**
 * Crée un rôle back-office portant exactement les permissions données.
 *
 * Les droits sont résolus depuis la table, jamais écrits ici : un slug qu'aucun sync n'a posé laisse
 * le rôle sans droit, et la garde refuse — ce que le test doit voir.
 *
 * @param {readonly PermissionDefinition[]} [permissions] - Droits à attacher au rôle.
 * @param {string} [slugPrefix] - Préfixe du slug, quand le nom du rôle porte l'intention du test.
 * @returns {Promise<Role>} Le rôle persisté.
 */
export async function makeAdminRole(
  permissions: readonly PermissionDefinition[] = [],
  slugPrefix: string = 'role'
): Promise<Role> {
  const slug = `${slugPrefix}-${randomUUID().slice(0, 8)}`
  const role = await Role.updateOrCreate({ slug }, { name: slug, description: slug })

  if (permissions.length === 0) {
    return role
  }

  const persisted = await Permission.query().whereIn(
    'slug',
    permissions.map((definition) => definition.slug)
  )

  await role.related('permissions').sync(
    persisted.map((permission) => permission.id),
    false
  )

  return role
}

/**
 * Crée un administrateur actif et renvoie son jeton d'accès en clair.
 *
 * Un `role` nul produit un administrateur sans rôle : le cas qui doit répondre 403 et non 500.
 *
 * @param {Role | null} [role] - Rôle à porter, ou `null` pour aucun.
 * @returns {Promise<string>} Le jeton d'accès.
 */
export async function makeAdminToken(role: Role | null = null): Promise<string> {
  const admin = new Admin()
  admin.firstname = 'Test'
  admin.lastname = 'Admin'
  admin.email = `${randomUUID()}@aigle.test`
  admin.password = 'Motdepasse1!'
  admin.isActive = true

  if (role) {
    admin.roleId = role.id
  }

  await admin.save()

  if (!role) {
    await db.from('admins').where('id', admin.id).update({ role_id: null })
  }

  const token = await Admin.accessTokens.create(admin)

  return token.value!.release()
}
