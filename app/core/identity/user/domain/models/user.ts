import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import {
  BaseModel,
  beforeCreate,
  belongsTo,
  column,
  hasMany,
  hasOne,
  scope,
} from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import hash from '@adonisjs/core/services/hash'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import Wallet from '#core/money/wallet/domain/models/wallet'
import Country from '#core/catalog/country/domain/models/country'
import Transaction from '#core/money/transactions/domain/models/transaction'
import { uniqueID } from '#shared/utils/utiles'
import KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import { KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'
import { UserKycStatus, UserStatus } from '#core/identity/user/domain/enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import UserDevice from '#core/identity/device/domain/models/user_device'
import DebitPhone from '#core/identity/user/domain/models/debit_phone'

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
  declare status: UserStatus

  @column({ serializeAs: null })
  declare adresse: string | null

  @column()
  declare pictureUrl: string | null

  @column()
  declare accountType: string

  @column({ serializeAs: null })
  declare password: string

  @column({
    serializeAs: null,
  })
  declare pincode: string

  @column()
  declare kycLevel: KycLevelState

  @column()
  declare kycStatus: UserKycStatus

  @column()
  declare identityStatus: 'pending' | 'approved' | 'rejected'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
  })

  @beforeCreate()
  static async BaseModel(user: User) {
    if (!user.usersUid) user.usersUid = crypto.randomUUID()
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

  @belongsTo(() => Country, {
    foreignKey: 'countryId',
  })
  declare country: BelongsTo<typeof Country>

  @belongsTo(() => KycLevel, {
    foreignKey: 'kycLevel',
    localKey: 'level',
  })
  declare keyLevel: BelongsTo<typeof KycLevel>

  @hasOne(() => KycDocument, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare kycDocument: HasOne<typeof KycDocument>

  @hasMany(() => UserDevice, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare userDevices: HasMany<typeof UserDevice>

  @hasMany(() => DebitPhone, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare debitPhones: HasMany<typeof DebitPhone>

  static search = scope((query, searchTerm: string) => {
    query.where((subQuery) => {
      subQuery
        .where('firstname', 'like', `%${searchTerm}%`)
        .orWhere('lastname', 'like', `%${searchTerm}%`)
        .orWhere('phone', 'like', `%${searchTerm}%`)
        .orWhere('account_number', 'like', `%${searchTerm}%`)
    })
  })

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
