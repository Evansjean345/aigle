import type { ApplicationService } from '@adonisjs/core/types'
import LedgerRepository from '#core/ledger/domain/interfaces/ledger_repository'
import LedgerRepositoryImpl from '#core/ledger/infrastructure/repositories/ledger_repository_impl'

export default class LedgerProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(LedgerRepository, () => {
      return new LedgerRepositoryImpl()
    })
  }
}
