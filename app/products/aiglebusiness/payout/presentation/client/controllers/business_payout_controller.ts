import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import InitiatePayoutUseCase from '#aiglebusiness/payout/application/use_cases/initiate_payout.use_case'
import { payoutValidator } from '#aiglebusiness/payout/presentation/client/validators/payout_validator'
import type { PayoutActor, PayoutRequestDto } from '#aiglebusiness/payout/application/dtos/payout.dto'

/**
 * Controller du **transfert unique** business (Lot 1). Routeur mince : valide le payload, réduit le
 * membre authentifié à l'acteur d'audit, résout la **source** (`organisationId` = compte org) et
 * délègue au use case. Réponse `202` (mouvement `PENDING`, settlement par webhook).
 *
 * Autorisation gérée en amont par les middlewares (auth membre + `orgPermission(payout:initiate)`) ;
 * l'**éligibilité KYB** (entreprise niveau 2) est vérifiée dans le use case.
 */
@inject()
export default class BusinessPayoutController {
  constructor(private readonly initiatePayout: InitiatePayoutUseCase) {}

  async create({
    request,
    response,
    auth,
    params,
    deviceInfo,
    geoLocation,
  }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(payoutValidator)

    const organisationId = params.organisationId as string
    const member = auth.user! as { id: number; usersUid: string }
    const idempotencyKey = request.header('X-Idempotency-Key')

    const dto: PayoutRequestDto = {
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

    const actor: PayoutActor = { id: member.id, usersUid: member.usersUid }

    const result = await this.initiatePayout.execute(dto, actor, organisationId, idempotencyKey)
    return response.accepted(result)
  }
}
