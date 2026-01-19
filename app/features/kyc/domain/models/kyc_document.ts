import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { KycAttemp } from '#features/kyc/domain/models/kyc_attemp'
import User from '#features/user/domain/models/user'

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
}
