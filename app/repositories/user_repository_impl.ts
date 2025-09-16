import BaseUserRepository from '#shared/repositories/user_repository_impl'
import ResponseFormatter from '#responses/response_formatter'

export default class UserRepositoryImpl extends BaseUserRepository {
  async all() {
    try {
      const users = await super.all()
      return ResponseFormatter.create({ message: 'OK', code: 200, status: true, data: users })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la récupération des utilisateurs',
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async findById(id: number) {
    try {
      const user = await super.findById(id)
      return ResponseFormatter.create({ message: 'OK', code: 200, status: true, data: user || null })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la récupération de l'utilisateur",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async findByPhone(phone: string) {
    try {
      const user = await super.findByPhone(phone)
      return ResponseFormatter.create({ message: 'OK', code: 200, status: true, data: user || null })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la recherche de l'utilisateur",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async create(data: any, trx?: any) {
    try {
      const user = await super.create(data, trx)
      return ResponseFormatter.create({ message: 'Créé', code: 201, status: true, data: user })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la création de l'utilisateur",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async save(user: any, trx?: any) {
    try {
      const saved = await super.save(user, trx)
      return ResponseFormatter.create({ message: 'Mis à jour', code: 200, status: true, data: saved })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la sauvegarde de l\'utilisateur',
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async updateByPhone(data: { phone: string; password: string }, trx?: any) {
    try {
      const user = await super.updateByPhone(data, trx)
      return ResponseFormatter.create({ message: 'Mis à jour', code: 200, status: true, data: user })
    } catch (err) {
      if (err?.message === 'USER_NOT_FOUND') {
        return ResponseFormatter.create({
          message: 'Utilisateur introuvable avec ce numéro',
          code: 404,
          status: false,
          data: null,
        })
      }
      return ResponseFormatter.create({
        message: 'Erreur lors de la mise à jour du mot de passe',
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async delete(id: number, trx?: any) {
    try {
      await super.delete(id, trx)
      return ResponseFormatter.create({
        data: true,
        message: 'Suppression effectuée avec succès',
        code: 200,
        status: true,
      })
    } catch (err) {
      if (err?.message === 'USER_NOT_FOUND') {
        return ResponseFormatter.create({
          data: null,
          message: 'Utilisateur non trouvé',
          code: 404,
          status: false,
        })
      }
      return ResponseFormatter.create({
        message: "Erreur lors de la suppression de l'utilisateur",
        code: 500,
        error: err,
        status: false,
      })
    }
  }
}
