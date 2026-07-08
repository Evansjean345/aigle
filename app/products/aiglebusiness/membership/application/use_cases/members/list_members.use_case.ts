import { inject } from '@adonisjs/core'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import { MemberResponseDTO } from '#aiglebusiness/membership/application/dtos/member.dto'

/**
 * Liste les membres d'une organisation (tous statuts), enrichis de l'identité
 * (nom, téléphone) résolue depuis le core par valeur.
 */
@inject()
export default class ListMembersUseCase {
  constructor(
    private readonly memberRepository: OrganisationMemberRepository,
    private readonly userDirectory: UserDirectoryService
  ) {}

  async execute(organisationId: string): Promise<MemberResponseDTO[]> {
    const members = await this.memberRepository.listByOrganisation(organisationId)

    // Résolution des identités en UNE requête (évite le N+1), indexées par id.
    const usersById = await this.userDirectory.mapByIds(members.map((member) => member.userId))

    return members.map((member) =>
      MemberResponseDTO.fromModel(member, usersById.get(member.userId) ?? null)
    )
  }
}
