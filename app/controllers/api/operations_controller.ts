import OperationService from '#services/operation_service'
import WebhookService from '#services/webhook_service'
import { createDepotValidator } from '#validators/transaction'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class OperationController {
  constructor(
    private operationService: OperationService,
    private webhookService: WebhookService
  ) {} // Changer le nom ici pour éviter la confusion

  async depot({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.operationService.depot(request.body(), auth)
    return response.status(operation.code).send(operation)
  }

  async transfert({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.operationService.transfert(request.body(), auth)
    return response.status(operation.code).send(operation)
  }

  async transfert_inter({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.operationService.transfert_inter_init_deposit(request.all(), auth)
    return response.status(operation.code).send(operation)
  }

  async airtime({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.operationService.airtime(request.all(), auth)
    return response.status(operation.code).send(operation)
  }
  async airtime_country_operator({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.operationService.airtime_country_operator(request.params())
    return response.status(operation.code).send(operation)
  }
  async airtime_country({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.operationService.airtime_country(auth)
    return response.status(operation.code).send(operation)
  }
}
