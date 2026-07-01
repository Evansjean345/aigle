import { BaseModel, belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { KycAttemp } from '#features/kyc/domain/models/kyc_attemp'
import User from '#features/user/domain/models/user'
import Admin from '#features/team/domain/models/admin'

export default class KycDocument extends BaseModel {
  static table = 'kyc_documents'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: string

  @column()
  declare documentType: KycDocumentType

  @column()
  declare documentRectoUrl?: string

  @column()
  declare documentVersoUrl?: string

  @column()
  declare selfieUrl?: string

  @column()
  declare status: KycDocumentStatus

  @column()
  declare platformVersion?: string

  @column()
  declare comment?: string

  @column()
  declare nextAction?: string

  @column()
  declare agentId: number | null

  @column.dateTime()
  declare validUntil?: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => KycAttemp, {
    foreignKey: 'kycDocumentId',
    localKey: 'id',
  })
  declare attempts: HasMany<typeof KycAttemp>

  @belongsTo(() => User, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Admin, {
    foreignKey: 'agentId',
  })
  declare agent: BelongsTo<typeof Admin>

  static filterByDateRange = scope((query, startDate?: string, endDate?: string) => {
    if (startDate && endDate) {
      query
        .where('created_at', '>=', `${startDate} 00:00:00`)
        .andWhere('created_at', '<=', `${endDate} 23:59:59`)
    } else if (startDate) {
      query
        .where('created_at', '>=', `${startDate} 00:00:00`)
        .andWhere('created_at', '<=', `${startDate} 23:59:59`)
    }
  })
}
