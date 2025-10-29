import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AirtimeService from '#services/airtime_services'
import { airtimeValidator } from '#validators/operation'
import GetAirtimeOptionsUseCase from '#mobile/airtime/use_cases/get_airtime_options.use_case'
import GetAirtimeToOptionsUseCase from '#mobile/airtime/use_cases/get_airtime_to_options.use_case'
import QuoteAirtimeUseCase from '#mobile/airtime/use_cases/quote_airtime.use_case'
import PurchaseAirtimeUseCase from '#mobile/airtime/use_cases/purchase_airtime.use_case'
import {
  quoteAirtimeValidator,
  purchaseAirtimeValidator,
} from '#mobile/airtime/validators/airtime.validators'

@inject()
export default class MobileAirtimeController {
  constructor(
    private airtimeService: AirtimeService,
    private getOptionsUseCase: GetAirtimeOptionsUseCase,
    private getToOptionsUseCase: GetAirtimeToOptionsUseCase,
    private quoteUseCase: QuoteAirtimeUseCase,
    private purchaseUseCase: PurchaseAirtimeUseCase
  ) {}

  // New Mobile feature endpoints (options/quote/purchase)
  async getOptions({ params, response }: HttpContext) {
    const result = await this.getOptionsUseCase.execute(params.serviceType)
    return response.ok(result)
  }

  async getToOptions({ params, response }: HttpContext) {
    const result = await this.getToOptionsUseCase.execute(
      params.serviceType,
      params.fromProviderCode
    )
    return response.ok(result)
  }

  async quote({ request, response }: HttpContext) {
    const payload = await request.validateUsing(quoteAirtimeValidator)
    const result = await this.quoteUseCase.execute(payload)
    return response.ok(result)
  }

  async purchase({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(purchaseAirtimeValidator)
    const user = auth.user!!
    const result = await this.purchaseUseCase.execute({ ...payload, user })
    return response.created(result)
  }

  // Legacy-wrapped endpoints delegating to existing AirtimeService
  // POST /mobile/airtime
  async airtime({ response, request, auth }: HttpContext) {
    const payload = await request.validateUsing(airtimeValidator)
    const result = await this.airtimeService.airtime_first_step(request.all(), auth)
    return response.status(result.code).send(result)
  }

  // GET /mobile/airtime/country
  async country({ response }: HttpContext) {
    const result = await this.airtimeService.airtime_country()
    return response.ok(result)
  }

  // GET /mobile/airtime/country/operator/:code
  async countryOperator({ response, request }: HttpContext) {
    const result = await this.airtimeService.airtime_country_operator(request)
    return response.status(result.code).send(result)
  }
}
