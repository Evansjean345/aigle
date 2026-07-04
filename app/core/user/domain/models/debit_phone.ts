import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#core/user/domain/models/user'
import Provider from '#core/catalogs/domain/models/provider'

export default class DebitPhone extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: string

  @column()
  declare providerId: number

  @column()
  declare phone: string

  @column()
  declare label: string | null

  @column()
  declare isVerified: boolean

  @column()
  declare isActive: boolean

  @column.dateTime()
  declare verifiedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId', localKey: 'usersUid' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Provider, { foreignKey: 'providerId' })
  declare provider: BelongsTo<typeof Provider>
}
