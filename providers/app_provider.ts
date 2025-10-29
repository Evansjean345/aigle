import { SettingInterface } from '../app/contracts/setting_interface.js'

export default class AppProvider {
  async boot() {
    const { SettingRepository } = await import('#repositories/setting_repository')

    this.app.container.bind(SettingInterface, () => {
      return  this.app.container.make(SettingRepository)
    })
  }
}
