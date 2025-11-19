import ServiceType from '#features/appServices/domain/models/service_type'

export interface ListServiceTypesParams {
  page?: number
  limit?: number
  q?: string
}

export default class ServiceTypeRepository {
  async paginate(params: ListServiceTypesParams) {
    const { page = 1, limit = 20, q } = params
    const query = ServiceType.query().orderBy('id', 'desc')
    if (q) {
      query.where((builder) => {
        builder.whereILike('code', `%${q}%`).orWhereILike('label', `%${q}%`)
      })
    }
    return query.paginate(Number(page), Number(limit))
  }

  findByIdOrFail(id: number) {
    return ServiceType.findOrFail(id)
  }

  async create(data: { code: string; label: string; description?: string | null }) {
    return ServiceType.create(data)
  }

  async update(
    id: number,
    data: Partial<{ code: string; label: string; description?: string | null }>
  ) {
    const item = await ServiceType.findOrFail(id)
    item.merge(data)
    await item.save()
    return item
  }

  async delete(id: number) {
    const item = await ServiceType.findOrFail(id)
    await item.delete()
  }
}
