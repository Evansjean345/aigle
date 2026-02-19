import { inject } from '@adonisjs/core'
import Permission from '#features/team/domain/models/permission'
import {
  CreatePermissionRequestDto,
  PermissionResponseDto,
} from '#features/team/application/dtos/permission.dto'
import PermissionRepository from '#features/team/domain/interfaces/permission_repository'
import PermissionSlugAlreadyExistsException from '#features/team/infrastructure/exceptions/permission_slug_already_exists_exception'
import Admin from '#features/team/domain/models/admin'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class CreatePermissionUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {PermissionRepository} permissionRepository - The repository instance to manage permission data.
   */
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Executes the creation of a new permission based on the provided data.
   *
   * @param {CreatePermissionRequestDto} data - The data required to create a new permission.
   * @param {Admin} auth - The authenticated admin user performing the operation.
   * @return {Promise<PermissionResponseDto>} A promise that resolves with the newly created permission's details.
   * @throws {PermissionSlugAlreadyExistsException}
   */
  async execute(data: CreatePermissionRequestDto, auth: Admin): Promise<PermissionResponseDto> {
    try {
      const existingPermission = await this.permissionRepository.findBySlug(data.slug)
      if (existingPermission) throw new PermissionSlugAlreadyExistsException()

      const permission = new Permission()
      permission.slug = data.slug
      permission.name = data.name
      permission.description = data.description ?? null

      await this.permissionRepository.save(permission)

      await emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'PERMISSION_CREATED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Permission',
        targetId: String(permission.id),
        result: AuditResult.SUCCESS,
        newValues: { slug: permission.slug, name: permission.name },
      })

      return {
        id: permission.id,
        slug: permission.slug,
        name: permission.name,
        description: permission.description,
        createdAt: permission.createdAt.toJSDate(),
        updatedAt: permission.updatedAt.toJSDate(),
      }
    } catch (error) {
      await emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'PERMISSION_CREATION_FAILED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Permission',
        result: AuditResult.FAILURE,
        metadata: { ...data },
        errorCode: error.code || 'PERMISSION_CREATION_ERROR',
        errorMessage: error.message || 'La création de la permission a échoué',
      })
      throw error
    }
  }
}
