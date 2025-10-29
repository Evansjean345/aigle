import { inject } from '@adonisjs/core'
import MobileAirtimeService from '#mobile/airtime/services/airtime_service'
import { QuoteAirtimeRequestDto } from '#mobile/airtime/dtos/quote_airtime.request'
import { QuoteAirtimeResultDto } from '#mobile/airtime/dtos/quote_airtime.result'

@inject()
export default class QuoteAirtimeUseCase {
  constructor(private airtimeService: MobileAirtimeService) {}

  async execute(payload: QuoteAirtimeRequestDto): Promise<QuoteAirtimeResultDto> {
    const spm = await this.airtimeService.getSpmForQuote(payload)
    return this.airtimeService.quoteFromSpm(spm, payload)
  }
}
