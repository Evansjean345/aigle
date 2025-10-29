import { inject } from '@adonisjs/core'
import MobileAirtimeService from '#mobile/airtime/services/airtime_service'
import { PurchaseAirtimeRequestDto } from '#mobile/airtime/dtos/purchase_airtime.request'
import { PurchaseAirtimeResultDto } from '#mobile/airtime/dtos/purchase_airtime.result'
import { Exception } from '@adonisjs/core/exceptions'

@inject()
export default class PurchaseAirtimeUseCase {
  constructor(private airtimeService: MobileAirtimeService) {}

  async execute(payload: PurchaseAirtimeRequestDto): Promise<PurchaseAirtimeResultDto> {
    const spm = await this.airtimeService.getSpmForQuote({
      serviceType: payload.serviceType,
      fromProviderCode: payload.fromProviderCode,
      toProviderCode: payload.toProviderCode,
      amount: payload.amount,
      currency: payload.currency,
    })

    if (spm.minAmount && payload.amount < spm.minAmount) {
      throw new Exception('Amount below minimum', { status: 400, code: 'AMOUNT_MIN' })
    }
    const maxAmount: number | undefined = (spm as any).maxAmount
    if (maxAmount && payload.amount > maxAmount) {
      throw new Exception('Amount above maximum', { status: 400, code: 'AMOUNT_MAX' })
    }

    const quote = this.airtimeService.quoteFromSpm(spm, {
      serviceType: payload.serviceType,
      fromProviderCode: payload.fromProviderCode,
      toProviderCode: payload.toProviderCode,
      amount: payload.amount,
      currency: payload.currency,
    })

    const providerTxId = `ATX-${Date.now()}`

    // TODO: integrate wallet debit and provider call; persist transaction

    return {
      reference: providerTxId,
      status: 'SUCCESS',
      providerTxId,
      message: 'Airtime purchase successful',
    }
  }
}
