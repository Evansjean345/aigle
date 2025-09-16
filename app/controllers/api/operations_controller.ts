import AirtimeService from '#services/airtime_services'
import OperationService from '#services/operation_service'
import TransfertInterService from '#services/transfert_inter'
import { airtimeValidator, transfertValidator } from '#validators/operation'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class OperationController {
  constructor(
    private operationService: OperationService,
    private airtimeService: AirtimeService,
    private transfertInterService: TransfertInterService
  ) {}

  async depot({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.operationService.depot(request.body(), auth)
    return response.status(operation.code).send(operation)
  }

  async transfert({ response, request, auth }: HttpContext) {
    // const payload = await transfertValidator.validate(request.all())
    const operation = await this.operationService.transfert(request.body(), auth)
    return response.status(operation.code).send(operation)
  }

  async transfert_inter({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.transfertInterService.transfert_inter_init_deposit(
      request.all(),
      auth
    )
    return response.status(operation.code).send(operation)
  }

  async data_forfait({ response, request, auth }: HttpContext) {
    // const payload = await airtimeValidator.validate(request.params())
    const operation = await this.airtimeService.data_forfait(request.params())
    return response.status(operation.code).send(operation)
  }

  async demande_virement({ response, request, auth }: HttpContext) {
    // const payload = await airtimeValidator.validate(request.params())
    const operation = await this.operationService.demande_virement(request,auth)
    return response.send(operation)
  }

  async liste_virement({ response, request, auth }: HttpContext) {
    // const payload = await airtimeValidator.validate(request.params())
    const operation = await this.operationService.liste_virement()
    return response.send(operation)
  }
  async airtime({ response, request, auth }: HttpContext) {
    const payload = await airtimeValidator.validate(request.all())
    const operation = await this.airtimeService.airtime_first_step(request.all(), auth)
    return response.status(operation.code).send(operation)
  }

  async airtime_country_operator({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.params())
    const operation = await this.airtimeService.airtime_country_operator(request)
    return response.status(operation.code).send(operation)
  }
  async airtime_country({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const operation = await this.airtimeService.airtime_country(auth)
    return response.status(operation.code).send(operation)
  }
}
