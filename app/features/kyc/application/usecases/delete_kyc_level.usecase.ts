import KycLevelRepository from '#features/kyc/domain/imterfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'

@inject()
export default class DeleteKycLevelUseCase {
  constructor(private readonly kycLevelRepository: KycLevelRepository) {}

  async execute(id: number): Promise<void> {
    const kycLevel = await this.kycLevelRepository.findById(id)
    if (!kycLevel) {
      throw new Exception('Niveau KYC non trouvé', { status: 404 })
    }

    // On pourrait ajouter une vérification pour voir si des utilisateurs sont liés à ce niveau
    // mais pour l'instant on reste simple ou on laisse la contrainte de clé étrangère agir.

    await this.kycLevelRepository.delete(kycLevel)
  }
}
