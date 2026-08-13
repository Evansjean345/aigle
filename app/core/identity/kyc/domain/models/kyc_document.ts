import { BaseModel, belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { KycDocumentStatus, KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'
import User from '#core/identity/user/domain/models/user'
import Admin from '#core/team/domain/models/admin'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

/**
 * Dossier de vérification d'un compte.
 *
 * `ownerType` en distingue les deux natures : pièces d'identité pour un compte utilisateur,
 * documents d'entreprise pour un compte d'organisation. `documentType` ne qualifie que le premier
 * cas.
 *
 * Les pièces vivent dans `document_pieces`. Les colonnes `documentRectoUrl`, `documentVersoUrl` et
 * `selfieUrl` ne sont plus écrites : elles portent les dossiers antérieurs à la bascule et sont lues
 * en repli quand le dossier n'a aucune pièce.
 */
export default class KycDocument extends BaseModel {
  static table = 'kyc_documents'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare accountId: string

  @column()
  declare ownerType: AccountOwnerType

  /**
   * Porteur du dossier, hérité d'avant l'ancrage sur le compte.
   *
   * N'est plus ni écrite ni lue : `accountId` la remplace. Reste déclarée le temps qu'un
   * déploiement confirme qu'aucun chemin ne l'attend.
   */
  @column()
  declare userId: string

  @column()
  declare documentType?: KycDocumentType

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

  @hasMany(() => DocumentPiece, {
    foreignKey: 'kycDocumentId',
    localKey: 'id',
  })
  declare pieces: HasMany<typeof DocumentPiece>

  /**
   * Porteur du dossier, quand c'est un utilisateur.
   *
   * Joint sur `account_id`, colonne d'ancrage : un dossier d'organisation n'a pas de porteur et
   * la relation reste vide.
   */
  @belongsTo(() => User, {
    foreignKey: 'accountId',
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
