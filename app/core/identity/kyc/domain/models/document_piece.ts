import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'

/**
 * Pièce d'un dossier de vérification.
 *
 * `fileKey` est la clé de l'objet sur le stockage privé : la consultation passe par une URL signée
 * générée à la lecture. `reference` porte le numéro inscrit sur la pièce quand elle en a un.
 */
export default class DocumentPiece extends BaseModel {
  static table = 'document_pieces'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare kycDocumentId: number

  @column()
  declare pieceType: DocumentPieceType

  @column()
  declare fileKey: string

  @column()
  declare reference?: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => KycDocument, {
    foreignKey: 'kycDocumentId',
    localKey: 'id',
  })
  declare kycDocument: BelongsTo<typeof KycDocument>
}
