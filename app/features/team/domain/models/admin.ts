import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import hash from '@adonisjs/core/services/hash'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Role from '#features/team/domain/models/role'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class Admin extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare firstname: string

  @column()
  declare lastname: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string | null

  @column()
  declare roleId: number

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  @column()
  declare isActive: boolean

  @column()
  declare lastLoginIp: string

  @column.dateTime({ serializeAs: null })
  declare lastLoginAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare invitationToken: string | null

  @column.dateTime({ serializeAs: null })
  declare invitationExpiresAt: DateTime | null

  static accessTokens = DbAccessTokensProvider.forModel(Admin, {
    expiresIn: '5 hours',
    table: 'admin_auth_access_tokens',
  })

  static refreshToken = DbAccessTokensProvider.forModel(Admin, {
    expiresIn: '1 days',
    tokenSecretLength: 64,
    table: 'admin_auth_access_tokens',
  })
}
