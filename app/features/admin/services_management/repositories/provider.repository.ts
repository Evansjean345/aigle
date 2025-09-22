import Provider, { ProviderType } from '#shared/models/provider'

export interface ListProvidersParams {
  page?: number
  limit?: number
  q?: string
  type?: ProviderType
}

export default class ProviderRepository {
  async paginate(params: ListProvidersParams) {
    const { page = 1, limit = 20, q, type } = params
    const query = Provider.query().orderBy('id', 'desc')
    if (q) {
      query.where((builder) => {
        builder.whereILike('code', `%${q}%`).orWhereILike('name', `%${q}%`)
      })
    }
    if (type) {
      query.andWhere('type', String(type))
    }
    return query.paginate(Number(page), Number(limit))
  }

  findByIdOrFail(id: number) {
    return Provider.findOrFail(id)
  }

  async create(data: { code: string; name: string; type: ProviderType }) {
    return Provider.create(data as any)
  }

  async update(id: number, data: Partial<{ code: string; name: string; type: ProviderType }>) {
    const item = await Provider.findOrFail(id)
    item.merge(data)
    await item.save()
    return item
  }

  async delete(id: number) {
    const item = await Provider.findOrFail(id)
    await item.delete()
  }
}
