import { SettingInterface } from '../app/contracts/setting_interface.js'

export default class AppProvider {
  public async boot() {
    // Enregistrement de l'implémentation concrète pour l'interface PaymentService
    const { SettingRepository } = await import('#repositories/setting_repository')
    this.app.container.singleton(SettingInterface, () => {
      return new SettingRepository()
    })
  }
}
