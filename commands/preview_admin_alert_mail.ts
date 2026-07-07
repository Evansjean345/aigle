import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class PreviewAdminAlertMail extends BaseCommand {
  static commandName = 'preview:admin-alert-mail'
  static description = ''

  static options: CommandOptions = {}

  async run() {
    this.logger.info('Hello world from "PreviewAdminAlertMail"')
  }
}
