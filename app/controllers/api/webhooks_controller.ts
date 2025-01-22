// import type { HttpContext } from '@adonisjs/core/http'

import WebhookService from '#services/webhook_service'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class WebhooksController {
  constructor(private webhookService: WebhookService) {}
  async web_hook_transfer_success({ response, request }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.webhookService.web_hook_transfer_success(request.body())
    return response.status(operation.code).send(operation)
  }

  async web_hook_transfer_failure({ response, request }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.webhookService.web_hook_transfer_failure(request.body())
    return response.status(operation.code).send(operation)
  }

  async web_hook_deposit_success({ response, request }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.webhookService.web_hook_deposit_success(request.body())
    return response.status(operation.code).send(operation)
  }

  async web_hook_deposit_failure({ response, request }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.webhookService.web_hook_deposit_failure(request.body())
    return response.status(operation.code).send(operation)
  }

  async web_hook_transfert_inter_success({ response, request }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.webhookService.web_hook_transfert_inter_success(request.body())
    return response.status(operation.code).send(operation)
  }

  async web_hook_transfert_inter_failure({ response, request }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.webhookService.web_hook_transfert_inter_failure(request.body())
    return response.status(operation.code).send(operation)
  }
}
