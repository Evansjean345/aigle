import Wallet from '#models/wallet'
import Country from '#models/country'
import Document from '#models/document'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, beforeSave, hasOne, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import hash from '@adonisjs/core/services/hash'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import { uniqueID } from '../helpers/utiles.js'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['phone'],
  passwordColumnName: 'pincode',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true, serializeAs: null })
  declare id: number

  @hasOne(() => Wallet, {
    foreignKey: 'users_id',
  })
  declare wallet: HasOne<typeof Wallet>

  @hasOne(() => Document, {
    foreignKey: 'users_id',
  })
  declare document: HasOne<typeof Document>

  @belongsTo(() => Country, {
    foreignKey: 'country_id',
  })
  declare country: BelongsTo<typeof Country>

  @column()
  declare country_id: number

  @hasMany(() => Transaction, {
    foreignKey: 'users_id', // Utilisation de 'user_id' comme convention de clé étrangère
  })
  declare transactions: HasMany<typeof Transaction>

  @column()
  declare firstname: string | null

  @column({ serializeAs: null })
  declare users_uid: string | null

  @column()
  declare lastname: string | null

  @column()
  declare account_number: string

  @column({ serializeAs: null })
  declare email: string | null

  @column()
  declare phone: string

  @column()
  declare birthday: Date

  @column()
  declare status: string | 'active' | 'inactive'

  @column({ serializeAs: null })
  declare adresse: string | null

  @column()
  declare picture_url: string | null

  @column()
  declare account_type: string

  @column({ serializeAs: null })
  declare password: string

  @column({ serializeAs: null })
  declare pincode: string

  @column()
  declare identity_status: string | 'pending' | 'approved' | 'rejected'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    // prefix: 'oat_',
    // table: 'auth_access_tokens',
    // type: 'auth_token',HttpContext
    // tokenSecretLength: 40,
  })

  static hidden() {
    return ['password', 'remember_me_token', 'usersUid', 'id', 'usersUid', 'pincode']
  }
  @beforeSave()
  static async BaseModel(user: User) {
    user.users_uid = uuidv4()
    user.account_number = uniqueID(8)
  }
}
