import { NewUser as UserInterface, User as UserInterfaces } from '#interfaces/user'

import ResponseFormatter from '#responses/response_formatter'
import Country from '#models/country'

export default class CountryRepository {
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

  async find_by_iso_code(isoCode: string) {
    try {
      const country = await Country.findBy('iso_code', isoCode.toUpperCase())
      return ResponseFormatter.create({
        data: country,
        message: 'pays trouvé',
        code: 200,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: `Pays non dispinible`,
        code: 404,
        error: err,
        status: false,
      })
    }
  }
}
