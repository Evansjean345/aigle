import DocumentRepository from '#repositories/document_repository'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { cuid } from '@adonisjs/core/helpers'
import { generateUrl } from '../helpers/file_helpers.js'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'

@inject()
export default class IdentityVerifyService {
  constructor(private documentRepository: DocumentRepository) {}
  async create_or_update(request: any, auth: any) {
    let trx = await db.beginGlobalTransaction()
    try {
      const user = auth.user
      await user.load('document')
      let docRecto = request.file('doc_recto')
      let docVerso = request.file('doc_verso')
      let pofile = request.file('profile')
      let pictureUrl: string = user?.id + generateUrl(pofile.extname)

      let data = {
        doc_recto: user.id + generateUrl(docRecto?.extname),
        doc_verso: user.id + generateUrl(docVerso?.extname),
        type: request.input('type'),
        users_uid: user.users_uid,
      }

      await docRecto.moveToDisk(data.doc_recto)
      await docVerso.moveToDisk(data.doc_verso)
      await pofile.moveToDisk(data.doc_verso)
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
        console.log('verification errror', response.error)

        await trx.rollback()
        return response
      }

      user.picture_url = pictureUrl
      let responseUpdate = await user.save()
      if (!responseUpdate) {
        await trx.rollback()
        return response
      }

      trx.commit()

      console.log('verification ok')

      return response
    } catch (error) {
      console.log('verification errror', error)

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
