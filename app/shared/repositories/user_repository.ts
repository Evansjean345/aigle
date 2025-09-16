import User from '#models/user'
import { NewUser as UserInterface, User as UserInterfaces } from '#interfaces/user'
import db from '@adonisjs/lucid/services/db'

import ResponseFormatter from '#responses/response_formatter'

export default class UserRepository {
  async all() {
    try {
      const users = await User.all()
      return ResponseFormatter.create({
        data: users,
        message: 'Liste des utilisateurs',
        code: 200,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Une erreur s'est produite lors de la récupération des utilisateurs",
        code: 500,
        error: err,
        status: false,
      })
    }
  }

  async findById(id: number) {
    try {
      const user = await User.findOrFail(id)
      return ResponseFormatter.create({
        data: user,
        message: 'Utilisateur trouvé',
        code: 200,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: `Utilisateur avec l'ID ${id} non trouvé`,
        code: 404,
        error: err,
        status: false,
      })
    }
  }

  async findByPhone(phone: string): Promise<ReturnType<typeof ResponseFormatter.create>> {
    try {
      const user = await User.query().where('phone', phone).first()

      console.log(user);

      if (user) {
        return ResponseFormatter.create({
          data: user,
          message: 'Utilisateur trouvé ',
          code: 200,
        })
      }
      return ResponseFormatter.create({
        data: null,
        message: 'Utilisateur non trouvé',
        code: 200,
        status: false,
        error: true,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Une erreur s'est produite",
        code: 500,
        error: err,
        status: false,
      })
    }
  }

  async create(data: UserInterface) {
    const transaction = await db.transaction()

    try {
      const user = await User.create(data)
      await transaction.commit()
      return ResponseFormatter.create({
        data: user,
        message: 'Compte créé avec succès',
        code: 201,
      })
    } catch (err) {
      await transaction.rollback()
      return ResponseFormatter.create({
        message: "Erreur lors de la création de l'utilisateur",
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async update(data: UserInterfaces) {
    const transaction = await db.transaction()
    try {
      const user = await User.find(data.id)
      if (!user) {
        return ResponseFormatter.create({
          data: null,
          message: 'Utilisateur non trouvé',
          code: 404,
          status: false,
        })
      }
      user.merge(data)
      await user.save()
      await transaction.commit()
      return ResponseFormatter.create({
        data: user,
        message: 'Mise à jour effectuée avec succès',
        code: 200,
      })
    } catch (err) {
      await transaction.rollback()
      return ResponseFormatter.create({
        message: "Erreur lors de la mise à jour de l'utilisateur",
        code: 500,
        error: err,
        status: false,
      })
    }
  }

  async updateByPhone(data: UserInterfaces) {
    const transaction = await db.transaction()
    try {
      const user = await User.findBy('phone', data.phone)
      if (!user) {
        return ResponseFormatter.create({
          data: null,
          message: 'Utilisateur non trouvé',
          code: 404,
          status: false,
        })
      }
      user.merge(data)
      await user.save()
      await transaction.commit()
      return ResponseFormatter.create({
        data: user,
        message: 'Mise à jour effectuée avec succès',
        code: 200,
      })
    } catch (err) {
      await transaction.rollback()
      return ResponseFormatter.create({
        message: "Erreur lors de la mise à jour de l'utilisateur",
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async delete(id: number) {
    const transaction = await db.transaction()
    try {
      const user = await User.find(id)
      if (!user) {
        return ResponseFormatter.create({
          data: null,
          message: 'Utilisateur non trouvé',
          code: 404,
          status: false,
        })
      }
      await user.delete()
      await transaction.commit()
      return ResponseFormatter.create({
        data: user,
        message: 'Suppression effectuée avec succès',
        code: 200,
      })
    } catch (err) {
      await transaction.rollback()
      return ResponseFormatter.create({
        message: "Erreur lors de la suppression de l'utilisateur",
        code: 500,
        error: err,
        status: false,
      })
    }
  }
}
