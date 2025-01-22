import OperationService from '#services/operation_service'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

@inject()
export default class WebhookService {
  constructor(protected operationServivce: OperationService) {}

  // webhook service transfert
  async web_hook_transfer_failure(data: any) {
    const ctx = await db.beginGlobalTransaction()
    let response = data?.data
    let result = await this.operationServivce.update_data_operation_failure(response)
    let transaction = result.data.transaction
    let wallet = result.data.wallet
    if (transaction?.status === 'failed') {
      const walletUpdate = await this.operationServivce.updateBalance(
        wallet,
        transaction?.total_amount,
        'add'
      )

      if (!walletUpdate?.status) {
        await ctx.rollback()

        return ResponseFormatter.create({
          message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
          code: 500,
          status: false,
          error: true,
        })
      }
    }
    console.log(result)
    return result
  }

  async web_hook_transfer_success(data: any) {
    console.log('webhook transfer success lancer')
    let response = data?.data
    let result = await this.operationServivce.update_data_operation_success(response)
    return result
  }
  // fin

  // webhook service depot
  async web_hook_deposit_success(data: any) {
    console.log('webhook deposit success lancer')
    let response = data?.data
    let result = await this.operationServivce.update_data_operation_success(response)
    return result
  }

  async web_hook_deposit_failure(data: any) {
    console.log('webhook deposit failure lancer')
    let response = data?.data
    let result = await this.operationServivce.update_data_operation_failure(response)
    return result
  }
  // fin
  // webhook service trasnfert inter mobile_money
  async web_hook_transfert_inter_success(data: any) {
    console.log('webhook transfert inter success lancer')

    let response = data?.data
    let result = await this.operationServivce.update_data_operation_success(response)
    let paymentBeneficiaire = result?.data?.transaction?.payment[1]
    if (paymentBeneficiaire?.status === 'pending') {
      result = await this.operationServivce.transfert_inter_init_transfert(result?.data)
    }

    return result
  }

  async web_hook_transfert_inter_failure(data: any) {
    const ctx = await db.beginGlobalTransaction()

    let response = data?.data
    let result = await this.operationServivce.update_data_operation_failure(response)

    let transaction = result.data.transaction
    let wallet = result.data.wallet
    let payment = result.data.payment[1]

    if (
      transaction?.status === 'failed' &&
      payment.operation_type === 'transfer' &&
      payment.status === 'failed'
    ) {
      const walletUpdate = await this.operationServivce.updateBalance(
        wallet,
        transaction?.total_amount,
        'add'
      )

      if (!walletUpdate?.status) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
          code: 500,
          status: false,
          error: true,
        })
      }
    }
    return result
  }
  // fin
}
