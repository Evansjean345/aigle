import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import DocumentMigrateLegacyPieces from '../../../commands/document_migrate_legacy_pieces.js'
import DocumentConvertPieceUrls from '../../../commands/document_convert_piece_urls.js'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'
import { DocumentPieceType, KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

const BUCKET = env.get('S3_BUCKET') as string

/** URL de dépôt public, telle que `uploadFile` en produisait. */
const legacyUrl = (folder: string) =>
  `https://${BUCKET}.s3.amazonaws.com/${folder}/${randomUUID()}/${randomUUID()}.jpg`

/**
 * Exécute la reprise et rend son code de sortie.
 *
 * @param {string[]} args - Arguments de ligne de commande.
 * @returns {Promise<number>} Le code de sortie.
 */
async function runMigration(args: string[] = []): Promise<number> {
  const ace = await app.container.make('ace')
  ace.ui.switchMode('raw')

  const command = await ace.create(DocumentMigrateLegacyPieces, args)
  await command.exec()

  return command.exitCode ?? 0
}

/**
 * Exécute la conversion et rend son code de sortie.
 *
 * @param {string[]} args - Arguments de ligne de commande.
 * @returns {Promise<number>} Le code de sortie.
 */
async function runConversion(args: string[] = []): Promise<number> {
  const ace = await app.container.make('ace')
  ace.ui.switchMode('raw')

  const command = await ace.create(DocumentConvertPieceUrls, args)
  await command.exec()

  return command.exitCode ?? 0
}

/**
 * Reprise des pièces héritées vers `document_pieces`.
 *
 * Le lot P2 du chantier de stockage privé : les colonnes d'URL deviennent des pièces portant une
 * clé, sans que le stockage soit touché.
 */
test.group('Kyc | Reprise des pièces héritées', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    // La commande balaie les tables entières. La base de développement est anonymisée : ses URL
    // sont des `placehold.co` que la garde de provenance refuse, et qui feraient sortir la reprise
    // en code 1 quel que soit le cas semé. On neutralise donc le terrain — la transaction annule.
    const blank = { document_recto_url: null, document_verso_url: null, selfie_url: null }
    await db.from('kyc_documents').update(blank)
    await db.from('kyc_attemps').update(blank)

    // Même raison pour la conversion : elle balaie `document_pieces` entière, et la base porte
    // déjà des pièces reprises en attente de conversion. Chaque test doit maîtriser son terrain.
    await db.from('document_pieces').update({ is_public_url: false })

    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  /** Sème un dossier portant les trois colonnes héritées, et rend son identifiant. */
  async function seedDocument(urls: {
    recto?: string
    verso?: string
    selfie?: string
  }): Promise<number> {
    const accountId = randomUUID()

    const [id] = await db.table('kyc_documents').insert({
      account_id: accountId,
      user_id: accountId,
      owner_type: AccountOwnerType.USER,
      status: KycDocumentStatus.APPROVED,
      document_recto_url: urls.recto ?? null,
      document_verso_url: urls.verso ?? null,
      selfie_url: urls.selfie ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    })

    return Number(id)
  }

  test('une URL du bucket devient une pièce, et sa colonne est vidée', async ({ assert }) => {
    const id = await seedDocument({
      recto: legacyUrl('kyc_documents'),
      selfie: legacyUrl('kyc_selfies'),
    })

    assert.equal(await runMigration(), 0)

    const pieces = await DocumentPiece.query().where('kyc_document_id', id)

    assert.sameMembers(
      pieces.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.SELFIE]
    )
    // La clé est un chemin, jamais une URL : c'est tout l'objet de la reprise.
    assert.isTrue(pieces.every((piece) => !piece.fileKey.includes('://')))

    const row = await db.from('kyc_documents').where('id', id).first()

    assert.isNull(row.document_recto_url)
    assert.isNull(row.selfie_url)
  })

  test('rejouer la reprise ne change rien', async ({ assert }) => {
    const id = await seedDocument({ recto: legacyUrl('kyc_documents') })

    await runMigration()
    const first = await DocumentPiece.query().where('kyc_document_id', id)

    assert.equal(await runMigration(), 0)
    const second = await DocumentPiece.query().where('kyc_document_id', id)

    // L'idempotence est ce qui remplace la reprise après interruption (D10).
    assert.lengthOf(second, first.length)
    assert.deepEqual(
      second.map((piece) => piece.fileKey),
      first.map((piece) => piece.fileKey)
    )
  })

  test('une URL étrangère est déplacée telle quelle, et signalée à convertir', async ({
    assert,
  }) => {
    const foreign = 'https://placehold.co/900x620/e2e8f0/475569.png?text=RCCM'
    const id = await seedDocument({ recto: foreign })

    // Elle se dérive pourtant en clé : la garde de provenance refuse de la traiter comme telle,
    // sans pour autant la laisser hors de la table (D13).
    assert.equal(await runMigration(), 0)

    const piece = await DocumentPiece.query().where('kyc_document_id', id).firstOrFail()
    const row = await db.from('kyc_documents').where('id', id).first()

    assert.equal(piece.fileKey, foreign)
    assert.isTrue(Boolean(piece.isPublicUrl))
    assert.isNull(row.document_recto_url)
  })

  test('une valeur du bucket est marquée comme clé, pas comme URL', async ({ assert }) => {
    const id = await seedDocument({ recto: legacyUrl('kyc_documents') })

    await runMigration()

    const piece = await DocumentPiece.query().where('kyc_document_id', id).firstOrFail()

    // C'est ce drapeau qui décide, à la lecture, entre signer et servir tel quel.
    assert.isFalse(Boolean(piece.isPublicUrl))
  })

  test('les tentatives perdent leurs URL sans rien déplacer', async ({ assert }) => {
    const documentId = await seedDocument({ recto: legacyUrl('kyc_documents') })
    const accountId = randomUUID()

    const [attemptId] = await db.table('kyc_attemps').insert({
      user_id: accountId,
      account_id: accountId,
      kyc_document_id: documentId,
      attempt_number: 1,
      status: KycDocumentStatus.APPROVED,
      document_recto_url: legacyUrl('kyc_documents'),
      selfie_url: legacyUrl('kyc_selfies'),
      created_at: new Date(),
      updated_at: new Date(),
    })

    await runMigration()

    const attempt = await db.from('kyc_attemps').where('id', Number(attemptId)).first()

    assert.isNull(attempt.document_recto_url)
    assert.isNull(attempt.selfie_url)
  })

  test('la simulation ne touche à rien', async ({ assert }) => {
    const url = legacyUrl('kyc_documents')
    const id = await seedDocument({ recto: url })

    await runMigration(['--dry-run'])

    const pieces = await DocumentPiece.query().where('kyc_document_id', id)
    const row = await db.from('kyc_documents').where('id', id).first()

    assert.isEmpty(pieces)
    assert.equal(row.document_recto_url, url)
  })

  test('la conversion transforme une URL du bucket en clé', async ({ assert }) => {
    const id = await seedDocument({ recto: legacyUrl('kyc_documents') })
    await runMigration()

    // La reprise range ; la conversion, elle, transforme. Deux gestes, deux commandes.
    await db.from('document_pieces').where('kyc_document_id', id).update({ is_public_url: true })

    assert.equal(await runConversion(), 0)

    const piece = await DocumentPiece.query().where('kyc_document_id', id).firstOrFail()

    assert.notInclude(piece.fileKey, '://')
    assert.isFalse(Boolean(piece.isPublicUrl))
  })

  test('la conversion refuse une URL étrangère et le signale', async ({ assert }) => {
    const foreign = 'https://placehold.co/900x620/e2e8f0/475569.png?text=RCCM'
    const id = await seedDocument({ recto: foreign })
    await runMigration()

    // Elle reste servie telle quelle : fermer S3 la rendrait illisible, d'où le code 1.
    assert.equal(await runConversion(), 1)

    const piece = await DocumentPiece.query().where('kyc_document_id', id).firstOrFail()

    assert.equal(piece.fileKey, foreign)
    assert.isTrue(Boolean(piece.isPublicUrl))
  })

  test('la conversion en simulation ne touche à rien', async ({ assert }) => {
    const id = await seedDocument({ recto: legacyUrl('kyc_documents') })
    await runMigration()
    await db.from('document_pieces').where('kyc_document_id', id).update({ is_public_url: true })

    const before = await DocumentPiece.query().where('kyc_document_id', id).firstOrFail()

    await runConversion(['--dry-run'])

    const after = await DocumentPiece.query().where('kyc_document_id', id).firstOrFail()

    assert.equal(after.fileKey, before.fileKey)
    assert.isTrue(Boolean(after.isPublicUrl))
  })
})
