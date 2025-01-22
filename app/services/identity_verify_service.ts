import DocumentRepository from '#repositories/document_repository'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { cuid } from '@adonisjs/core/helpers'
import { generateUrl } from '../helpers/file_helpers.js'
import app from '@adonisjs/core/services/app'

@inject()
export default class IdentityVerifyService {
  constructor(private documentRepository: DocumentRepository) {}
  async create_or_update(request: any, auth: any) {
    let trx = await db.transaction()
    try {
      const user = auth.user
      await user.load('document')

      let docRecto = request.file('doc_recto')
      let docVerso = request.file('doc_verso')
      let pofile = request.file('pofile')

      let data = {
        doc_recto: generateUrl(docRecto.extname),
        doc_verso: generateUrl(docVerso.extname),
        type: request.input('type'),
        users_uid: user.users_uid,
      }

      await docRecto.move(app.makePath('storage/uploads'), { name: data.doc_recto })
      await docVerso.move(app.makePath('storage/uploads'), { name: data.doc_verso })
      await pofile.move(app.makePath('storage/uploads'), { name: generateUrl(pofile.extname) })

      // await docRecto.moveToDisk(data.doc_recto)
      // await docVerso.moveToDisk(data.doc_verso)
      // await pofile.moveToDisk(generateUrl(pofile.extname))

      if (user.identity_status === 'approved') {
        return ResponseFormatter.create({
          message: "Vous avez déjà soumis votre pièce d'identité",
          code: 400,
          status: false,
          error: true,
        })
      }

      let response = await this.documentRepository.create_or_update({ users_id: user.id }, data)

      if (response.error) {
        await trx.rollback()
        return response
      }

      user.picture_url = generateUrl(pofile.extname)
      let responseUpdate = await user.save()
      if (!responseUpdate) {
        await trx.rollback()
        return response
      }

      return response
    } catch (error) {
      await trx.rollback()
      return ResponseFormatter.create({
        message: 'Une erreur interne est survénue',
        code: 500,
        status: false,
        error: error,
      })
    }
  }
}
