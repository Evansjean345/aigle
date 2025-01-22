import { DateTime } from 'luxon'
import { BaseModel, beforeSave, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

export default class Document extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare doucuments_uid: string

  @column()
  declare users_id: number

  @column()
  declare users_uid: string

  @column()
  declare doc_recto: string | null

  @column()
  declare doc_verso: string | null

  @column()
  declare type: string | null

  @column()
  declare dfe: string | null

  @column()
  declare rccm: string | null

  @column()
  declare status: string | 'valid' | 'invalid'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
  @beforeSave()
  static async BaseModel(document: Document) {
    document.doucuments_uid = uuidv4()
  }
}
