import { inject } from '@adonisjs/core'
import MobileAirtimeService from '#mobile/airtime/services/airtime_service'

@inject()
export default class GetAirtimeToOptionsUseCase {
  constructor(private airtimeService: MobileAirtimeService) {}

  async execute(serviceTypeCode: string, fromProviderCode: string) {
    return this.airtimeService.getToOptionsByServiceType(serviceTypeCode, fromProviderCode)
  }
}
