import type { DateTime } from 'luxon'
import type ServiceProviderMethod from '#core/catalogs/domain/models/service_provider_method'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'

// Contrat repository (filtre de liste + Command) vit dans le domaine (DDD strict). Ré-exporté ici
// pour que controllers/use cases continuent de l'importer depuis le DTO.
export type {
  ListServiceProviderMethodsQuery,
  CreateServiceProviderMethodCommand,
  UpdateServiceProviderMethodCommand,
} from '#core/catalogs/domain/types/service_provider_method_repository_types'

// ── RequestDto (input controller → use case) ──────────────────────────

export interface CreateServiceProviderMethodRequestDto {
  serviceTypeId: number
  paymentMethodId: number
  providerFromId: number
  providerToId?: number | null
  feeFixed?: number
  feePercent?: number
  minAmount?: number
  currency?: string
  isActive?: boolean
}

export interface UpdateServiceProviderMethodRequestDto {
  serviceTypeId?: number
  paymentMethodId?: number
  providerFromId?: number
  providerToId?: number | null
  feeFixed?: number
  feePercent?: number
  minAmount?: number
  currency?: string
  isActive?: boolean
}

// ── ResponseDTO (output HTTP) ───────────────────────────────────────

export interface ServiceProviderMethodProviderDTO {
  id: number
  code: string
  name: string
  logo: string | null
}

export interface ServiceProviderMethodServiceTypeDTO {
  id: number
  code: string
  label: string
}

export interface ServiceProviderMethodPaymentMethodDTO {
  id: number
  code: string
  label: string
}

export class ServiceProviderMethodResponseDTO {
  declare id: number
  declare serviceType: ServiceProviderMethodServiceTypeDTO
  declare paymentMethod: ServiceProviderMethodPaymentMethodDTO
  declare providerFrom: ServiceProviderMethodProviderDTO
  declare providerTo: ServiceProviderMethodProviderDTO | null
  declare feeFixed: number | string
  declare feePercent: number
  declare minAmount: number
  declare currency: string
  declare isActive: boolean
  declare isInterNetwork: boolean
  declare networkType: 'intra' | 'inter'
  declare displayName: string
  declare createdAt: DateTime
  declare updatedAt: DateTime

  static fromServiceProviderMethod(
    method: ServiceProviderMethod
  ): ServiceProviderMethodResponseDTO {
    const dto = new ServiceProviderMethodResponseDTO()

    dto.id = method.id
    dto.serviceType = method.serviceType
      ? {
          id: method.serviceType.id,
          code: method.serviceType.code,
          label: method.serviceType.label,
        }
      : { id: 0, code: '', label: '' }
    dto.paymentMethod = method.paymentMethod
      ? {
          id: method.paymentMethod.id,
          code: method.paymentMethod.code,
          label: method.paymentMethod.label,
        }
      : { id: 0, code: '', label: '' }
    dto.providerFrom = method.providerFrom
      ? {
          id: method.providerFrom.id,
          code: method.providerFrom.code,
          name: method.providerFrom.name,
          logo: method.providerFrom.logo ?? null,
        }
      : { id: 0, code: '', name: '', logo: null }
    dto.providerTo = method.providerTo
      ? {
          id: method.providerTo.id,
          code: method.providerTo.code,
          name: method.providerTo.name,
          logo: method.providerTo.logo ?? null,
        }
      : null
    dto.feeFixed = typeof method.feeFixed === 'bigint' ? Number(method.feeFixed) : method.feeFixed
    dto.feePercent = method.feePercent
    dto.minAmount = method.minAmount
    dto.currency = method.currency
    dto.isActive = method.isActive
    dto.isInterNetwork = !!method.providerToId && method.providerToId !== method.providerFromId
    dto.networkType = dto.isInterNetwork ? 'inter' : 'intra'
    dto.displayName = dto.isInterNetwork
      ? `${dto.providerFrom.name} → ${dto.providerTo?.name ?? '?'}`
      : dto.providerFrom.name
    dto.createdAt = method.createdAt
    dto.updatedAt = method.updatedAt
    return dto
  }
}

export interface ServiceProviderMethodPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
}

export interface PaginatedServiceProviderMethodsResponseDTO {
  data: ServiceProviderMethodResponseDTO[]
  meta: ServiceProviderMethodPaginationMeta
}

export class ServiceProviderMethodListResponseDTO {
  static fromPaginator(
    paginator: ModelPaginatorContract<ServiceProviderMethod>
  ): PaginatedServiceProviderMethodsResponseDTO {
    return {
      data: paginator
        .all()
        .map((method) => ServiceProviderMethodResponseDTO.fromServiceProviderMethod(method)),

      meta: {
        total: paginator.total,
        currentPage: paginator.currentPage,
        firstPage: paginator.firstPage,
        lastPage: paginator.lastPage,
        perPage: paginator.perPage,
      },
    }
  }
}
