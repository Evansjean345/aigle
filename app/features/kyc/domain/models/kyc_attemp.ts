import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'

export class KycAttemp extends BaseModel {
  static table = 'kyc_attemps'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: string

  @column()
  declare documentType: KycDocumentType

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

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
