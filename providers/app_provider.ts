import { type ApplicationService } from '@adonisjs/core/types'
import GeoIpService from '#shared/infrastructure/services/geoip_service'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  async register() {
    this.app.container.singleton('GeoIpService', async () => {
      return new GeoIpService()
    })
  }

  async boot() {}
}
