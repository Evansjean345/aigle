import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { KycDocumentStatus, KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import Admin from '#core/team/domain/models/admin'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export class KycAttemp extends BaseModel {
  static table = 'kyc_attemps'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: string

  @column()
  declare documentType: KycDocumentType

  @column()
  declare documentRectoUrl?: string

  @column()
  declare kycDocumentId: number

  @column()
  declare documentVersoUrl?: string

  @column()
  declare selfieUrl?: string

  @column()
  declare attemptNumber: number

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

  @belongsTo(() => KycDocument, {
    foreignKey: 'kycDocumentId',
    localKey: 'id',
  })
  declare kycDocument: BelongsTo<typeof KycDocument>

  @belongsTo(() => Admin, {
    foreignKey: 'agentId',
  })
  declare agent: BelongsTo<typeof Admin>
}
