import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import InitiateTransferUseCase from '#aiglebusiness/transfer/application/use_cases/initiate_transfer.use_case'
import { transferValidator } from '#aiglebusiness/transfer/presentation/client/validators/transfer_validator'
import type {
  TransferActor,
  TransferRequestDto,
} from '#aiglebusiness/transfer/application/dtos/transfer.dto'

/**
 * Controller du **transfert unique** business. Routeur mince : valide le payload, réduit le membre
 * authentifié à l'acteur d'audit, résout la **source** (`organisationId` = compte org) et délègue au
 * use case. Réponse `202` (mouvement `PENDING`, settlement par webhook).
 *
 * Autorisation gérée en amont par les middlewares (auth membre + `orgPermission(transfer:initiate)`).
 * Le plafonnement (limites du compte) est appliqué dans le core (`PartyValidator`).
 */
@inject()
export default class BusinessTransferController {
  constructor(private readonly initiateTransfer: InitiateTransferUseCase) {}

  async create({
    request,
    response,
    auth,
    params,
    deviceInfo,
    geoLocation,
  }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(transferValidator)

    const organisationId = params.organisationId as string
    const member = auth.user! as { id: number; usersUid: string }
    const idempotencyKey = request.header('X-Idempotency-Key')

    const dto: TransferRequestDto = {
      amount: payload.amount,
      phone: payload.phone,
      providerCode: payload.providerCode,
      paymentMethodCode: payload.paymentMethodCode,
      deviceInfo,
      geoIpLocation: geoLocation,
      ipAddress: geoLocation?.ip ?? null,
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    }

    const actor: TransferActor = { id: member.id, usersUid: member.usersUid }

    const result = await this.initiateTransfer.execute(dto, actor, organisationId, idempotencyKey)
    return response.accepted(result)
  }
}