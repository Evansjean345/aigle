import { inject } from '@adonisjs/core'
import { UpdateRoleRequestDto, RoleResponseDto } from '#core/team/application/dtos/role.dto'
import RoleRepository from '#core/team/domain/interfaces/role_repository'
import RoleNotFoundException from '#core/team/infrastructure/exceptions/role_not_found_exception'
import RoleSlugAlreadyExistsException from '#core/team/infrastructure/exceptions/role_slug_already_exists_exception'
import string from '@adonisjs/core/helpers/string'
import emitter from '@adonisjs/core/services/emitter'
import Admin from '#core/team/domain/models/admin'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class UpdateRoleUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {RoleRepository} roleRepository - The repository instance to manage role data.
   */
  constructor(private roleRepository: RoleRepository) {}

  /**
   * Executes the update of an existing role based on the provided data.
   *
   * @param {number} id - The ID of the role to update.
   * @param {UpdateRoleRequestDto} data - The data to update the role with.
   * @param {Admin} auth - The authenticated admin user performing the operation.
   * @return {Promise<RoleResponseDto>} A promise that resolves with the updated role's details.
   * @throws {RoleNotFoundException}
   * @throws {RoleSlugAlreadyExistsException}
   */
  async execute(id: number, data: UpdateRoleRequestDto, auth: Admin): Promise<RoleResponseDto> {
    try {
      const role = await this.roleRepository.findById(id)
      if (!role) throw new RoleNotFoundException()

      if (data.name !== undefined) {
        const newSlug = string.slug(data.name, { lower: true, replacement: '_' })

        if (newSlug !== role.slug) {
          const existingRole = await this.roleRepository.findBySlug(newSlug)
          if (existingRole) throw new RoleSlugAlreadyExistsException()
          role.slug = newSlug
        }

        role.name = data.name
      }
      if (data.description !== undefined) role.description = data.description

      await this.roleRepository.save(role)

      emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'ROLE_UPDATED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Role',
        targetId: String(role.id),
        result: AuditResult.SUCCESS,
        newValues: { slug: role.slug, name: role.name, description: role.description },
      })

      if (data.permissionIds !== undefined) {
        await this.roleRepository.syncPermissions(role, data.permissionIds)
        emitter.emit('activity:audit', {
          eventCategory: 'TEAM',
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

      const updatedRole = await this.roleRepository.findById(role.id)

      return {
        id: updatedRole!.id,
        slug: updatedRole!.slug,
        name: updatedRole!.name,
        description: updatedRole!.description,
        permissions: updatedRole!.permissions.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          createdAt: p.createdAt.toJSDate(),
          updatedAt: p.updatedAt.toJSDate(),
        })),
        createdAt: updatedRole!.createdAt.toJSDate(),
        updatedAt: updatedRole!.updatedAt.toJSDate(),
      }
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'ROLE_UPDATE_FAILED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Role',
        targetId: String(id),
        result: AuditResult.FAILURE,
        metadata: { ...data },
        errorCode: error.code || 'ROLE_UPDATE_ERROR',
        errorMessage: error.message || 'La mise à jour du rôle a échoué',
      })
      throw error
    }
  }
}
