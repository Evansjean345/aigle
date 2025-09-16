import { DateTime } from 'luxon'
import { compose, cuid } from '@adonisjs/core/helpers'
import {
  BaseModel,
  column,
  hasOne,
  hasMany,
  belongsTo,
  beforeSave,
  beforeCreate,
} from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import hash from '@adonisjs/core/services/hash'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import Wallet from '#shared/models/wallet'
import Document from '#shared/models/document'
import Country from '#shared/models/country'
import Transaction from '#shared/models/transaction'
import { uniqueID } from '../../helpers/utiles.js'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['phone'],
  passwordColumnName: 'pincode',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true, serializeAs: null })
  declare id: number

  @column()
  declare countryId: number

  @column()
  declare firstname: string

  @column()
  declare lastname: string

  @column()
  declare usersUid: string

  @column()
  declare accountNumber: string

  @column({ serializeAs: null })
  declare email: string | null

  @column()
  declare phone: string

  @column()
  declare birthday: Date

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column({ serializeAs: null })
  declare adresse: string | null

  @column()
  declare pictureUrl: string | null

  @column()
  declare accountType: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare pincode: string

  @column()
  declare identityStatus: 'pending' | 'approved' | 'rejected'

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

  @beforeCreate()
  static async BaseModel(user: User) {
    if (!user.usersUid) user.usersUid = cuid()
    if (!user.accountNumber) user.accountNumber = uniqueID(8)
  }

  static hidden() {
    return ['password', 'remember_me_token', 'id', 'pincode']
  }

  @hasMany(() => Transaction, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare transactions: HasMany<typeof Transaction>

  @hasOne(() => Wallet, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare wallet: HasOne<typeof Wallet>

  @hasOne(() => Document, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare document: HasOne<typeof Document>

  @belongsTo(() => Country, {
    foreignKey: 'countryId',
  })
  declare country: BelongsTo<typeof Country>
}
