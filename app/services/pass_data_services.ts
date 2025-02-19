import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import OperationService from './operation_service.js'
import { calculateFee } from '../helpers/fee_helpers.js'

@inject()
export default class PassDataService {
  constructor(protected operationService: OperationService) {}
  async data_first_step(data: any, auth: any) {
    const ctx = await db.beginGlobalTransaction()
    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet
      // calcule les frais de l'encaissement
      let result = await calculateFee(data?.amount, data?.operation_type, 'add')
      data.fees = result.fees
      data.total_amount = result.total

      // enregistrer les informationse de la transaction
      let transaction = await this.operationService.create_transaction(user, wallet, {
        ...data,
      })

      console.log('transaction created')

      if (transaction.error) {
        await ctx.rollback()
        return transaction
      }

      // enregistrer les informationns de la premiere étape
      let paymentDepotInit = await this.operationService.create_payment(transaction?.data, {
        payment_method: data.payment_method,
        fees: data.fees,
        amount: data.amount,
        total_amount: data.total_amount,
        payment_details: { ...data?.payment_details_first },
        step: data.step && data.step,
        status: data.status && data.status,
      })

      console.log('fisrt payment created')
      if (paymentDepotInit.error) {
        await ctx.rollback()
        return paymentDepotInit
      }
      // enregistrer les informations de la deuxieme etape comme draft
      let paymentDraft = await this.operationService.create_payment(transaction?.data, {
        payment_method: data.payment_method,
        fees: data.fees,
        amount: data.amount,
        total_amount: data.total_amount,
        payment_details: { ...data?.payment_details_seconde },
        step: data.step && data.step,
        status: 'draft',
      })

      if (paymentDraft.error) {
        await ctx.rollback()
        return paymentDraft
      }
      console.log('seconde payment created')
      // effectuer l'encaissement par mobile money
      let response = await this.operationService.mobile_money_checkout({
        operation_type: data?.payment_details_first?.operation_type,
        amount: data?.amount,
        provider: data?.payment_details_first?.operator,
        number: data?.payment_details_first?.debiteur_phone,
        pincode: data?.payment_details?.pincode ? data?.payment_details?.pincode : null,
        country: 'ci',
        currency: 'XOF',
        reference: transaction?.data?.reference,
        notify_success_url: process.env.NOTIFY_AIRTIME_SUCCESS_URL,
        notify_failure_url: process.env.NOTIFY_AIRTIME_FAILURE_URL,
      })

      if (response?.error) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: response?.error?.message,
          code: response?.error?.status,
          status: false,
          error: response,
        })
      }
      await ctx.commit()
      return ResponseFormatter.create({
        data: response.data,
        message: 'opération initiée',
        code: 200,
        status: true,
        error: false,
      })
    } catch (error) {
      await ctx.rollback()
      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation du transfert",
        code: 500,
        status: false,
        error: error,
      })
    }
  }
  async data_second_step(data: any) {
    try {
      let response = await this.operationService.hub_service(
        process.env.API_AIRTIME_URL,
        'post',
        data
      )
      if (response?.error) {
        return ResponseFormatter.create({
          message: "Une erreur lors de l'achat de airtime",
          code: 500,
          status: false,
          error: response?.error?.errors,
        })
      }

      if (response?.data?.status === 'success') {
        await this.airtime_by_second_step_callback(
          {
            reference: data?.reference,
          },
          'success'
        )
      } else {
        await this.airtime_by_second_step_callback(
          {
            reference: data?.reference,
          },
          'failure'
        )
      }
      console.log('airtime created successfully')

      return ResponseFormatter.create({
        data: response,
        message: 'achat effectué avec succèes',
        code: 200,
        status: true,
        error: false,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation de l'achat",
        code: 500,
        status: false,
        error: err,
      })
    }
  }
  async data_by_first_step_callback(response: any, status: string) {
    const ctx = await db.beginGlobalTransaction()
    try {
      // Récupération de la transaction avec les relations nécessaires
      const { transaction, payment, user, wallet } = await this.operationService.data_web_hook(
        response?.reference
      )
      let paymentData = payment[0]
      let secondeOperation = payment[1]
      if (status === 'success') {
        if (transaction.status === 'pending') {
          paymentData.status = 'success'
          paymentData.callback_status = true
          paymentData.operator_response = JSON.stringify(response)
          secondeOperation.status = 'pending'
          await paymentData.useTransaction(ctx).save()
          await paymentData.useTransaction(ctx).save()
          // Mise à jour du portefeuille
          const walletUpdate = await this.operationService.updateBalance(
            wallet,
            paymentData?.total_amount,
            'add'
          )
          if (!walletUpdate?.status) {
            return ResponseFormatter.create({
              message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
              code: 500,
              status: false,
              error: true,
            })
          }
          await ctx.commit()
          // lancer la deuxieme opération
          return await this.airtime_second_step({
            operator_id: secondeOperation?.payment_details?.operator_id,
            amount: secondeOperation?.amount,
            country_code: secondeOperation?.payment_details?.country_code,
            phone_number: secondeOperation?.payment_details?.beneficiare_phone,
            reference: transaction?.reference,
          })
        }
      }
      if (status === 'failure') {
        transaction.status = 'failed'
        transaction.balance_after = wallet.balance
        await transaction.useTransaction(ctx).save()
        // Mise à jour du paiement
        paymentData.status = 'failed'
        paymentData.callback_status = true
        paymentData.operator_response = JSON.stringify(response)
        await paymentData.useTransaction(ctx).save()
        await ctx.commit()
        return ResponseFormatter.create({
          message: 'opérartion échoué',
          code: 200,
          status: true,
          error: false,
          data: {
            transaction,
            payment,
            user,
            wallet,
          },
        })
      }

      return ResponseFormatter.create({
        message: 'opérartion',
        code: 200,
        status: true,
        error: false,
        data: {
          transaction,
          payment,
          user,
          wallet,
        },
      })
    } catch (error) {
      await ctx.rollback()
      return ResponseFormatter.create({
        message: "Une erreur s'est produite lors de l'opération",
        code: 500,
        status: false,
        error: error.message || error,
      })
    }
  }

  async data_by_second_step_callback(response: any, status: string) {
    const ctx = await db.beginGlobalTransaction()
    try {
      // Récupération de la transaction avec les relations nécessaires
      const { transaction, payment, user, wallet } = await this.operationService.data_web_hook(
        response?.reference
      )
      let secondeOperation = payment[1]
      if (status === 'success') {
        if (transaction.status === 'pending') {
          secondeOperation.status = 'success'
          secondeOperation.callback_status = true
          secondeOperation.operator_response = JSON.stringify(response)
          await secondeOperation.useTransaction(ctx).save()
          // Mise à jour de la transaction
          transaction.balance_after = wallet.balance
          transaction.status = 'success'
          await transaction.useTransaction(ctx).save()
          await ctx.commit()
        }
      }
      if (status === 'failure') {
        transaction.status = 'failed'
        transaction.balance_after = wallet.balance
        await transaction.useTransaction(ctx).save()
        // Mise à jour du paiement
        secondeOperation.status = 'failed'
        secondeOperation.callback_status = true
        secondeOperation.operator_response = JSON.stringify(response)
        await secondeOperation.useTransaction(ctx).save()
        const walletUpdate = await this.operationService.updateBalance(
          wallet,
          secondeOperation?.total_amount,
          'add'
        )
        await ctx.commit()
        return ResponseFormatter.create({
          message: "l'opération à échoué",
          code: 200,
          status: true,
          error: false,
          data: {
            transaction,
            payment,
            user,
            wallet,
          },
        })
      }

      return ResponseFormatter.create({
        message: 'opération eff',
        code: 200,
        status: true,
        error: false,
        data: {
          transaction,
          payment,
          user,
          wallet,
        },
      })
    } catch (error) {
      await ctx.rollback()
      return ResponseFormatter.create({
        message: "Une erreur s'est produite lors de l'opération",
        code: 500,
        status: false,
        error: error.message || error,
      })
    }
  }

  async data_forfait(request: any) {
    try {
      let forfait = []
      let response = await this.operationService.hub_service(
        `${process.env.API_AIRTIME_COUNTRY_URL}/${request.country_code}/operators?dataOnly=false&bundlesOnly=false&includeData=true&includeBundles=true`,
        'get',
        ''
      )
      if (response.error) {
        return ResponseFormatter.create({
          data: response.error,
          message: '',
          code: 400,
          status: true,
          error: false,
        })
      }
      response?.data.forEach((items: any) => {
        let operator = String(items.operator).split(' ')[0].toLocaleLowerCase()
        if (items.operator_id == request.operator) {
          Object.keys(items.fixed_amounts_description).map((key) =>
            forfait.push({
              price: Number(key).toFixed(0),
              forfait: items.fixed_amounts_description[key],
              operator_id: items.operator_id,
            })
          )
        }
      })

      return ResponseFormatter.create({
        data: forfait,
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
}
