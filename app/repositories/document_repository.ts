import ResponseFormatter from '#responses/response_formatter'
import Document from '#models/document'

export default class DocumentRepository {
  async create_or_update(attribute: any, data: any) {
    try {
      let response = await Document.updateOrCreate(attribute, data)

      return ResponseFormatter.create({
        data: response,
        message: 'Liste des utilisateurs',
        code: 200,
      })
    } catch (err) {
      console.log(err);

      return ResponseFormatter.create({
        message: "Une erreur s'est produite",
        code: 500,
        error: err,
        status: false,
      })
    }
  }
}
