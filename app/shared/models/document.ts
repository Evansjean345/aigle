import { DateTime } from 'luxon'
import { BaseModel, beforeSave, belongsTo, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'

export default class Document extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare doucuments_uid: string

  @column()
  declare users_id: number

  @belongsTo(() => User, {
    foreignKey: 'id',
  })
  declare user: BelongsTo<typeof User>

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
  declare status: string | 'pending' | 'valid' | 'invalid'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
  // static hidden() {
  //   return ['doc_recto', 'doc_recto', 'doucuments_uid', 'type']
  // }
  @beforeSave()
  static async BaseModel(document: Document) {
    document.doucuments_uid = uuidv4()
  }
}
