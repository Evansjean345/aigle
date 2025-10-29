import { inject } from '@adonisjs/core'
import MobileAirtimeService from '#mobile/airtime/services/airtime_service'
import { AirtimeOptionsResult } from '#mobile/airtime/dtos/airtime_options.result'

@inject()
export default class GetAirtimeOptionsUseCase {
  constructor(private airtimeService: MobileAirtimeService) {}

  async execute(serviceTypeCode: string): Promise<AirtimeOptionsResult> {
    return this.airtimeService.getOptionsByServiceType(serviceTypeCode)
  }
}
