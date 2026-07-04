import type { DateTime } from 'luxon'
import type Provider from '#core/catalogs/domain/models/provider'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export type ProviderType = 'mobile_money' | 'bank' | 'wallet'
export type ProviderStatus = 'active' | 'inactive'

// ── RequestDto (input controller → use case) ──────────────────────────

export interface ListProvidersRequestDto {
  page?: number
  limit?: number
  q?: string
  type?: ProviderType
  status?: ProviderStatus
}

export interface CreateProviderRequestDto {
  code: string
  name: string
  type: ProviderType
  logo?: string | null
}

export interface UpdateProviderRequestDto {
  code?: string
  name?: string
  type?: ProviderType
  logo?: string | null
}

// ── Command (input use case → repository) ───────────────────────────

export interface CreateProviderCommand {
  code: string
  name: string
  type: ProviderType
  logo?: string | null
}

export interface UpdateProviderCommand {
  code?: string
  name?: string
  type?: ProviderType
  logo?: string | null
}

// ── ResponseDTO (output HTTP) ───────────────────────────────────────

export class ProviderResponseDTO {
  declare id: number
  declare code: string
  declare name: string
  declare type: ProviderType
  declare status: ProviderStatus
  declare logo: string | null
  declare createdAt: DateTime
  declare updatedAt: DateTime

  static fromProvider(provider: Provider): ProviderResponseDTO {
    const dto = new ProviderResponseDTO()
    dto.id = provider.id
    dto.code = provider.code
    dto.name = provider.name
    dto.type = provider.type
    dto.status = provider.status
    dto.logo = provider.logo ?? null
    dto.createdAt = provider.createdAt
    dto.updatedAt = provider.updatedAt
    return dto
  }
}

export interface ProviderPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
}

export interface PaginatedProvidersResponseDTO {
  data: ProviderResponseDTO[]
  meta: ProviderPaginationMeta
}

export class ProviderListResponseDTO {
  static fromPaginator(paginator: ModelPaginatorContract<Provider>): PaginatedProvidersResponseDTO {
    return {
      data: paginator.all().map((provider) => ProviderResponseDTO.fromProvider(provider)),
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
