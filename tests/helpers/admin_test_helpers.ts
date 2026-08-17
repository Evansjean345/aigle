import { randomUUID } from 'node:crypto'
import Admin from '#core/team/domain/models/admin'
import Role from '#core/team/domain/models/role'
import Permission from '#core/team/domain/models/permission'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Administrateur porteur des permissions demandées, avec son jeton d'accès.
 *
 * Les permissions absentes de la base y sont créées : une suite ne dépend pas d'un seeder.
 *
 * @param {PermissionDefinition[]} permissions - Permissions que porte le rôle de cet administrateur.
 * @returns {Promise<{ admin: Admin; token: string }>} L'administrateur et son jeton `Bearer`.
 */
export async function makeAdminWith(
  permissions: PermissionDefinition[]
): Promise<{ admin: Admin; token: string }> {
  const role = await Role.create({
    slug: `role-${randomUUID().slice(0, 8)}`,
    name: 'Rôle de test',
  })

  const unknown = permissions.findIndex((permission) => !permission?.slug)
  if (unknown !== -1) {
    throw new Error(
      `makeAdminWith : la permission à l'index ${unknown} n'a pas de slug — clé inexistante dans le catalogue ?`
    )
  }

  const rows = await Promise.all(
    permissions.map((permission) =>
      Permission.firstOrCreate(
        { slug: permission.slug },
        { slug: permission.slug, name: permission.slug }
      )
    )
  )

  await role.related('permissions').attach(rows.map((row) => row.id))

  const admin = await Admin.create({
    firstname: 'Agent',
    lastname: 'Test',
    email: `agent-${randomUUID().slice(0, 8)}@aigle.test`,
    password: 'motdepasse',
    roleId: role.id,
  })

  const token = await Admin.accessTokens.create(admin)

  return { admin, token: token.value!.release() }
}
