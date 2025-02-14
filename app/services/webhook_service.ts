import OperationService from '#services/operation_service'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import AirtimeService from './airtime_services.js'
import PassDataService from './pass_data_services.js'
import PassMixService from './pass_miss_services.js'
import TransfertInterService from './transfert_inter.js'

@inject()
export default class WebhookService {
  constructor(
    protected operationServivce: OperationService,
    protected transfertInterService: TransfertInterService,
    protected airtimeService: AirtimeService,
    protected passDataService: PassDataService,
    protected passMixService: PassMixService
  ) {}
  static ischecked = null
  // webhook service transfert en cas d'échec
  async web_hook_transfer_failure(data: any) {
    let response = data?.data
    let result = await this.operationServivce.transfert_callback(response, 'failure')
    return result
  }
  // webhook service transfert en cas de succès
  async web_hook_transfer_success(data: any) {
    let response = data?.data
    let result = await this.operationServivce.transfert_callback(response, 'success')
    return result
  }

  // webhook service depot en cas de succès
  async web_hook_deposit_success(data: any) {
    let response = data?.data
    let result = await this.operationServivce.depot_callback(response, 'success')
    return result
  }

  // webhook service depot en cas de d'échec
  async web_hook_deposit_failure(data: any) {
    let response = data?.data
    let result = await this.operationServivce.depot_callback(response, 'failure')
    return result
  }

  // webhook de la premiere opératon de tranfert inter operateur en cas de succès
  async web_hook_transfert_inter_success(data: any) {
    let response = data?.data
    let result = await this.transfertInterService.transfert_inter_first_operation_callback(
      response,
      'success'
    )
    return result
  }

  // webhook de la premiere opération de tranfert inter operateur en cas d'echec
  async web_hook_transfert_inter_failure(data: any) {
    let response = data?.data
    let result = await this.transfertInterService.transfert_inter_first_operation_callback(
      response,
      'failure'
    )
    return result
  }

  // webhook de la premiere opératon de tranfert inter operateur en cas de succès
  async web_hook_transfert_inter_second_success(data: any) {
    let response = data?.data
    let result = await this.transfertInterService.transfert_inter_second_operation_callback(
      response,
      'success'
    )
    return result
  }

  // webhook de la deuxieme opération de tranfert inter operateur en cas d'echec
  async web_hook_transfert_inter_second_failure(data: any) {
    let response = data?.data
    let result = await this.transfertInterService.transfert_inter_second_operation_callback(
      response,
      'failure'
    )
    return result
  }

  // web achat de airtime en cas d'échec
  async web_hook_fisrt_step_airtime_failure(data: any) {
    let response = data?.data
    if (WebhookService.ischecked === response.reference) return
    WebhookService.ischecked = response.reference
    let result = await this.airtimeService.airtime_by_first_step_callback(response, 'failed')
    return result
  }

  // web achat de airtime en de succes
  async web_hook_fisrt_step_airtime_success(data: any) {
    let response = data?.data
    if (WebhookService.ischecked === response.reference) return
    WebhookService.ischecked = response.reference
    let result = await this.airtimeService.airtime_by_first_step_callback(response, 'success')
    return result
  }
}
