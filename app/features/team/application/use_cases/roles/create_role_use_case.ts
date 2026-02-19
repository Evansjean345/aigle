import { inject } from '@adonisjs/core'
import Role from '#features/team/domain/models/role'
import Admin from '#features/team/domain/models/admin'
import { CreateRoleRequestDto, RoleResponseDto } from '#features/team/application/dtos/role.dto'
import RoleRepository from '#features/team/domain/interfaces/role_repository'
import RoleSlugAlreadyExistsException from '#features/team/infrastructure/exceptions/role_slug_already_exists_exception'
import string from '@adonisjs/core/helpers/string'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class CreateRoleUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {RoleRepository} roleRepository - The repository instance to manage role data.
   */
  constructor(private roleRepository: RoleRepository) {}

  /**
   * Executes the creation of a new role based on the provided data.
   *
   * @param {CreateRoleRequestDto} data - The data required to create a new role.
   * @param {Admin} auth - The authenticated admin user performing the operation.
   * @return {Promise<RoleResponseDto>} A promise that resolves with the newly created role's details.
   * @throws {RoleSlugAlreadyExistsException}
   */
  async execute(data: CreateRoleRequestDto, auth: Admin): Promise<RoleResponseDto> {
    try {
      const slug = string.slug(data.name, { lower: true, replacement: '_' })

      const existingRole = await this.roleRepository.findBySlug(slug)
      if (existingRole) throw new RoleSlugAlreadyExistsException()

      const role = new Role()
      role.slug = slug
      role.name = data.name
      role.description = data.description ?? null

      await this.roleRepository.save(role)

      await emitter.emit('activity:audit', {
        eventCategory: 'ROLES',
        eventAction: 'ROLE_CREATED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Role',
        targetId: String(role.id),
        result: AuditResult.SUCCESS,
        newValues: { slug: role.slug, name: role.name },
      })

      if (data.permissionIds && data.permissionIds.length > 0) {
        await this.roleRepository.syncPermissions(role, data.permissionIds)
        await emitter.emit('activity:audit', {
          eventCategory: 'ROLE',
          eventAction: 'ROLE_PERMISSIONS_SYNCED',
          actorId: String(auth.id),
          actorType: 'Admin',
          actorRole: auth.role.name,
          targetType: 'Role',
          targetId: String(role.id),
          result: AuditResult.SUCCESS,
          newValues: { permissionIds: data.permissionIds },
        })
      }

      const savedRole = await this.roleRepository.findById(role.id)

      return {
        id: savedRole!.id,
        slug: savedRole!.slug,
        name: savedRole!.name,
        description: savedRole!.description,
        permissions: savedRole!.permissions.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          createdAt: p.createdAt.toJSDate(),
          updatedAt: p.updatedAt.toJSDate(),
        })),
        createdAt: savedRole!.createdAt.toJSDate(),
        updatedAt: savedRole!.updatedAt.toJSDate(),
      }
    } catch (error) {
      await emitter.emit('activity:audit', {
        eventCategory: 'ROLES',
        eventAction: 'ROLE_CREATION_FAILED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Role',
        result: AuditResult.FAILURE,
        metadata: { name: data.name },
        errorCode: error.code || 'ROLE_CREATION_ERROR',
        errorMessage: error.message || 'La création du rôle a échoué',
      })
      throw error
    }
  }
}
