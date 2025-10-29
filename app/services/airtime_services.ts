import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import { makeRequest } from '../helpers/http_helpers.js'
import env from '#start/env'

@inject()
export default class AirtimeService {
  constructor() {}
  // async airtime_first_step(data: any, auth: any) {
  //   const ctx = await db.beginGlobalTransaction()
  //   try {
  //     const user = auth.user
  //     await user.load('wallet')
  //     const wallet = user.wallet
  //     let encaissement: {
  //       data: any
  //       message: string
  //       code: number
  //       error: any
  //       status: boolean
  //     } | null = null
  //
  //     // calcule les frais de l'encaissement
  //     let result = await calculateFee(data?.amount, data?.operation_type, 'add')
  //     data.fees = result.fees
  //     data.total_amount = result.total
  //
  //     // enregistrer les informationse de la transaction
  //     let transaction = await this.operationService.create_transaction(user, wallet, {
  //       ...data,
  //     })
  //
  //     console.log('transaction created')
  //
  //     if (transaction.error) {
  //       await ctx.rollback()
  //       return transaction
  //     }
  //
  //     // enregistrer les informationns de la premiere étape
  //     let paymentDepotInit = await this.operationService.create_payment(transaction?.data, {
  //       payment_method: data.payment_method,
  //       fees: data.fees,
  //       amount: data.amount,
  //       total_amount: data.total_amount,
  //       payment_details: { ...data?.deposit_details },
  //       step: data.step && data.step,
  //       status: data.status && data.status,
  //     })
  //
  //     console.log('fisrt payment created')
  //     if (paymentDepotInit.error) {
  //       await ctx.rollback()
  //       return paymentDepotInit
  //     }
  //     // enregistrer les informations de la deuxieme etape comme draft
  //     let paymentDraft = await this.operationService.create_payment(transaction?.data, {
  //       payment_method: data.payment_method,
  //       fees: data.fees,
  //       amount: data.amount,
  //       total_amount: data.total_amount,
  //       payment_details: { ...data?.airtime_details },
  //       step: data.step && data.step,
  //       status: 'draft',
  //     })
  //
  //     if (paymentDraft.error) {
  //       await ctx.rollback()
  //       return paymentDraft
  //     }
  //     console.log('seconde payment created')
  //     // effectuer l'encaissement par mobile money
  //     switch (data.payment_method) {
  //       case 'mobile_money':
  //         encaissement = await this.operationService.mobile_money_checkout({
  //           operation_type: data?.deposit_details?.operation_type,
  //           amount: result?.total,
  //           provider: data?.deposit_details?.operator,
  //           number: data?.deposit_details?.debiteur_phone,
  //           pincode: data?.deposit_details?.pincode ? data?.deposit_details?.pincode : null,
  //           country: 'ci',
  //           currency: 'XOF',
  //           reference: transaction?.data?.reference,
  //           notify_success_url: process.env.NOTIFY_AIRTIME_SUCCESS_URL,
  //           notify_failure_url: process.env.NOTIFY_AIRTIME_FAILURE_URL,
  //         })
  //
  //         break
  //       case 'wallet':
  //         encaissement = await this.operationService.aigle_checkout(result.total, wallet)
  //         if (encaissement.status) {
  //           await ctx.commit()
  //           return this.airtime_by_first_step_callback(
  //             {
  //               reference: transaction?.data.reference,
  //             },
  //             'success'
  //           )
  //         }
  //         break
  //       default:
  //         break
  //     }
  //
  //     if (encaissement && encaissement?.error) {
  //       await ctx.rollback()
  //       return ResponseFormatter.create({
  //         message: encaissement?.message,
  //         code: encaissement?.code,
  //         error: encaissement?.error,
  //         status: false,
  //       })
  //     }
  //
  //     await ctx.commit()
  //     return ResponseFormatter.create({
  //       data: encaissement?.data,
  //       message: 'opération initiée',
  //       code: 200,
  //       status: true,
  //       error: false,
  //     })
  //   } catch (error) {
  //     await ctx.rollback()
  //     return ResponseFormatter.create({
  //       message: "Une erreur lors de l'initialisation du transfert",
  //       code: 500,
  //       status: false,
  //       error: error,
  //     })
  //   }
  // }
  // async airtime_second_step(data: AirtimeType, wallet: any) {
  //   try {
  //     let response = await this.operationService.hub_service(
  //       process.env.API_AIRTIME_URL,
  //       'post',
  //       data
  //     )
  //     if (response?.error) {
  //       await this.airtime_by_second_step_callback(
  //         {
  //           reference: data?.reference,
  //         },
  //         'failure'
  //       )
  //       return ResponseFormatter.create({
  //         message: "Une erreur lors de l'achat de airtime",
  //         code: 400,
  //         status: false,
  //         error: response?.error,
  //       })
  //     }
  //
  //     if (response?.data?.status === 'success') {
  //       await this.airtime_by_second_step_callback(
  //         {
  //           reference: data?.reference,
  //         },
  //         'success'
  //       )
  //     } else {
  //       await this.airtime_by_second_step_callback(
  //         {
  //           reference: data?.reference,
  //         },
  //         'failure'
  //       )
  //     }
  //     console.log('airtime created successfully')
  //
  //     return ResponseFormatter.create({
  //       data: response,
  //       message: 'achat effectué avec succèes',
  //       code: 200,
  //       status: true,
  //       error: false,
  //     })
  //   } catch (err) {
  //     return ResponseFormatter.create({
  //       message: "Une erreur lors de l'initialisation de l'achat",
  //       code: 500,
  //       status: false,
  //       error: err,
  //     })
  //   }
  // }
  // async airtime_by_first_step_callback(response: any, status: string) {
  //   const ctx = await db.beginGlobalTransaction()
  //   try {
  //     // Récupération de la transaction avec les relations nécessaires
  //     const { transaction, payment, user, wallet } = await this.operationService.data_web_hook(
  //       response?.reference
  //     )
  //     let paymentData = payment[0]
  //     let secondeOperation = payment[1]
  //     if (status === 'success') {
  //       if (transaction.status === 'pending') {
  //         paymentData.status = 'success'
  //         paymentData.callback_status = true
  //         paymentData.operator_response = JSON.stringify(response)
  //         secondeOperation.status = 'pending'
  //         await paymentData.useTransaction(ctx).save()
  //         await paymentData.useTransaction(ctx).save()
  //         // Mise à jour du portefeuille
  //         if (paymentData.payment_method !== 'wallet') {
  //           const walletUpdate = await this.operationService.updateBalance(
  //             wallet,
  //             paymentData?.total_amount,
  //             'add'
  //           )
  //
  //           if (!walletUpdate?.status) {
  //             return ResponseFormatter.create({
  //               message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
  //               code: 500,
  //               status: false,
  //               error: true,
  //             })
  //           }
  //         }
  //
  //         await ctx.commit()
  //         // lancer la deuxieme opération
  //         return await this.airtime_second_step(
  //           {
  //             operator_id: secondeOperation?.payment_details?.operator_id,
  //             amount: secondeOperation?.amount,
  //             country_code: secondeOperation?.payment_details?.country_code,
  //             phone_number: secondeOperation?.payment_details?.beneficiaire_phone,
  //             reference: transaction?.reference,
  //           },
  //           wallet
  //         )
  //       }
  //     }
  //     if (status === 'failure') {
  //       transaction.status = 'failed'
  //       transaction.balance_after = wallet.balance
  //       await transaction.useTransaction(ctx).save()
  //       // Mise à jour du paiement
  //       paymentData.status = 'failed'
  //       paymentData.callback_status = true
  //       paymentData.operator_response = JSON.stringify(response)
  //       await paymentData.useTransaction(ctx).save()
  //       await ctx.commit()
  //       return ResponseFormatter.create({
  //         message: 'opérartion échoué',
  //         code: 200,
  //         status: true,
  //         error: false,
  //         data: {
  //           transaction,
  //           payment,
  //           user,
  //           wallet,
  //         },
  //       })
  //     }
  //
  //     return ResponseFormatter.create({
  //       message: 'opérartion',
  //       code: 200,
  //       status: true,
  //       error: false,
  //       data: {
  //         transaction,
  //         payment,
  //         user,
  //         wallet,
  //       },
  //     })
  //   } catch (error) {
  //     await ctx.rollback()
  //     return ResponseFormatter.create({
  //       message: "Une erreur s'est produite lors de l'opération",
  //       code: 500,
  //       status: false,
  //       error: error.message || error,
  //     })
  //   }
  // }

  // async airtime_by_second_step_callback(response: any, status: string) {
  //   const ctx = await db.beginGlobalTransaction()
  //   try {
  //     // Récupération de la transaction avec les relations nécessaires
  //     const { transaction, payment, user, wallet } = await this.operationService.data_web_hook(
  //       response?.reference
  //     )
  //     let secondeOperation = payment[1]
  //     if (status === 'success') {
  //       if (transaction.status === 'pending') {
  //         secondeOperation.status = 'success'
  //         secondeOperation.callback_status = true
  //         secondeOperation.operator_response = JSON.stringify(response)
  //         await secondeOperation.useTransaction(ctx).save()
  //         // Mise à jour de la transaction
  //         transaction.balance_after = wallet.balance
  //         transaction.status = 'success'
  //         await transaction.useTransaction(ctx).save()
  //         await ctx.commit()
  //       }
  //     }
  //     if (status === 'failure') {
  //       if (transaction.status === 'pending') {
  //         transaction.status = 'failed'
  //         transaction.balance_after = wallet.balance
  //         await transaction.useTransaction(ctx).save()
  //         // Mise à jour du paiement
  //         secondeOperation.status = 'failed'
  //         secondeOperation.callback_status = true
  //         secondeOperation.operator_response = JSON.stringify(response)
  //         await secondeOperation.useTransaction(ctx).save()
  //         const walletUpdate = await this.operationService.updateBalance(
  //           wallet,
  //           secondeOperation?.total_amount,
  //           'add'
  //         )
  //         await ctx.commit()
  //       }
  //
  //       return ResponseFormatter.create({
  //         message: "l'opération à échoué",
  //         code: 200,
  //         status: true,
  //         error: response,
  //         data: {
  //           transaction,
  //           payment,
  //           user,
  //           wallet,
  //         },
  //       })
  //     }
  //
  //     return ResponseFormatter.create({
  //       message: 'opération éffectueé',
  //       code: 200,
  //       status: true,
  //       error: false,
  //       data: {
  //         transaction,
  //         payment,
  //         user,
  //         wallet,
  //       },
  //     })
  //   } catch (error) {
  //     await ctx.rollback()
  //     return ResponseFormatter.create({
  //       message: "Une erreur s'est produite lors de l'opération",
  //       code: 500,
  //       status: false,
  //       error: error.message || error,
  //     })
  //   }
  // }

  async airtime_country_operator(request: any) {
    try {
      let params = request.params()
      let data = request.qs()?.data ? true : false
      let bundle = request.qs()?.bundle ? true : false
      let operators = []

      const response = await makeRequest({
        uri: `${process.env.API_AIRTIME_COUNTRY_URL}/${params.code}/operators?dataOnly=false&bundlesOnly=false&includeData=${data}&includeBundles=${bundle}`,
        method: 'get',
        data: '',
      })

      if (bundle && data) {
        response?.data.forEach((items: any) => {
          let operator = String(items.operator).split(' ')[0].toLocaleLowerCase()
          if (items.denomination_type === 'FIXED') {
            operators.push({
              operator: operator,
              logo: items.logo_urls[2],
              id: items.operator_id,
              libele: items.data
                ? 'achat internet'
                : items.bundle
                  ? 'achat pack bundle'
                  : 'achat de passe ou internet',
            })
            console.log(operators)
          }
        })
      }

      if (response.error) {
        return ResponseFormatter.create({
          data: response.error,
          message: '',
          code: 400,
          status: true,
          error: false,
        })
      }

      return ResponseFormatter.create({
        data: operators.length > 0 ? operators : response?.data,
        message: '',
        code: 200,
        status: true,
        error: false,
      })
    } catch (error) {
      return ResponseFormatter.create({
        message: 'Une erreur ',
        code: 500,
        status: false,
        error: error,
      })
    }
  }
  async airtime_country() {
    try {
      const response = await makeRequest({
        uri: env.get('API_AIRTIME_COUNTRY_URL')!!,
        method: 'get',
        data: '',
      })

      console.log('response')
      console.log(response)

      return response.data
    } catch (error) {
      console.log('response error')
      console.log(error)
      throw new Error(error)
    }
  }
}
