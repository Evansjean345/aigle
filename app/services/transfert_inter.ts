import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import OperationService from './operation_service.js'
import { calculateFee } from '../helpers/fee_helpers.js'

@inject()
export default class TransfertInterService {
  constructor(protected operationService: OperationService) {}

  async transfert_inter_init_deposit(data: any, auth: any) {
    const ctx = await db.beginGlobalTransaction()

    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet
      // calcule des frais de transfert
      let result = await calculateFee(data?.amount, data?.service, 'subtract')
      data.fees = result.fees
      data.total_amount = result.total
      if (data?.debitaire?.operator === 'orange' && !data?.debitaire?.pincode) {
        return ResponseFormatter.create({
          message: 'Le code temporaire orange money est requis',
          code: 400,
          status: false,
          error: true,
        })
      }

      let transaction = await this.operationService.create_transaction(user, wallet, {
        ...data?.debitaire,
        operation_type: 'transfer_inter',
      })

      if (transaction.error) {
        await ctx.rollback()
        return transaction
      }

      // enregistrer le payment de la recuperation de font
      let paymentDepotInit = await this.operationService.create_payment(transaction?.data, {
        ...data?.debitaire,
        step: 'deposit_init',
      })

      if (paymentDepotInit.error) {
        await ctx.rollback()
        return paymentDepotInit
      }

      // enregistrer le payment du transfert de font au brouillont
      let paymentTrasnferInit = await this.operationService.create_payment(transaction?.data, {
        ...data?.beneficiaire,
        status: 'draft',
        step: 'transfert_init',
      })

      if (paymentTrasnferInit.error) {
        await ctx.rollback()
        return paymentTrasnferInit
      }

      // envoyer les données au service aigle hub
      let dataSend = {
        operation_type: paymentDepotInit?.data?.payment_method,
        amount: Number(paymentDepotInit?.data?.amount),
        provider: paymentDepotInit?.data?.payment_details?.operator,
        number: paymentDepotInit?.data?.payment_details?.debiteur_phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction?.data?.reference,
        notify_success_url: process.env.NOTIFY_TRANSFERT_INTER_SUCCESS_URL,
        notify_failure_url: process.env.NOTIFY_TRANSFERT_INTER_FAILURE_URL,
      }

      if (
        paymentDepotInit?.data?.payment_details?.operator === 'orange' &&
        paymentDepotInit?.data?.payment_details?.pincode
      ) {
        dataSend.otp = paymentDepotInit?.data?.payment_details?.pincode
      } else if (
        paymentDepotInit?.data?.payment_details?.operator === 'orange' &&
        !paymentDepotInit?.data?.payment_details?.pincode
      ) {
        return ResponseFormatter.create({
          message: 'Le code temporaire orange money est requis',
          code: 400,
          status: false,
          error: true,
        })
      }

      if (paymentDepotInit?.data?.payment_details?.operator === 'wave') {
        dataSend.success_url = 'https://ednashoppinggroup.com/#/'
        dataSend.error_url = 'https://ednashoppinggroup.com/#/'
      }

      let response = await this.operationService.hub_service(
        process.env.API_CHECKOUT_URL,
        'post',
        dataSend
      )

      if (response?.error) {
        // console.log(response?.error);

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
        message: 'Initialisation du dépot inter effectuée',
        code: 200,
        status: true,
        error: false,
        data: response?.data,
      })
    } catch (err) {
      await ctx.rollback()
      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation du transfert",
        code: 500,
        status: false,
        error: err,
      })
    }
  }
  async transfert_inter_init_transfert({ transaction, wallet, payment, user }: any) {
    const ctx = await db.beginGlobalTransaction()
    try {
      // envoyer les données au service aigle hub
      let paymentData = payment[1]

      let dataSend = {
        operation_type: paymentData.payment_method,
        amount: transaction.total_amount,
        provider: paymentData.payment_details?.operator,
        number: paymentData.payment_details?.beneficiaire_phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction.reference,
      }

      await paymentData.save()

      if (paymentData?.payment_details?.operator !== 'wave') {
        dataSend.notify_success_url = process.env.NOTIFY_TRANSFERT_INTER_SECOND_SUCCESS_URL
        dataSend.notify_failure_url = process.env.NOTIFY_TRANSFERT_INTER_SECOND_FAILURE_URL
      }

      const walletUpdate = await this.operationService.updateBalance(
        wallet,
        paymentData?.total_amount,
        'subtract'
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

      let response = await this.operationService.hub_service(
        process.env.API_TRANSFERT_URL,
        'post',
        dataSend
      )

      if (response?.error) {
        await this.operationService.update_data_operation_failure({
          reference: paymentData.transactions_uid,
        })
        return ResponseFormatter.create({
          message: "Une erreur lors de l'initialisation du transfert",
          code: 500,
          status: false,
          error: response?.error,
        })
      }

      if (
        response?.data?.status === 'success' &&
        paymentData?.payment_details?.operator === 'wave'
      ) {
        await this.operationService.update_data_operation_success(response?.data)
      }

      return ResponseFormatter.create({
        data: response?.data,
        message:
          payment?.data?.payment_details?.operator === 'wave'
            ? 'Transfert éffectué avec succès'
            : 'Initialisation du transfert effectuée',
        code: 200,
        status: true,
        error: false,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation du transfert",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async transfert_inter_first_operation_callback(response: any, status: string) {
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
          // calcule des frais de transfert
          let result = await calculateFee(transaction?.amount, 'transfer_inter', 'subtract')

          // Mise à jour du portefeuille
          const walletUpdate = await this.operationService.updateBalance(
            wallet,
            result?.total,
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
          // lancer la deuxiemem opération
          await this.transfert_inter_init_transfert({
            ...transaction,
            ...payment,
            ...user,
            ...wallet,
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
      }

      await ctx.commit()

      return ResponseFormatter.create({
        message: 'Dépôt effectué avec succès',
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

  async transfert_inter_second_operation_callback(response: any, status: string) {
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

        // calcule des frais de transfert
        let result = await calculateFee(secondeOperation?.amount, 'deposit', 'subtract')

        const walletUpdate = await this.operationService.updateBalance(wallet, result?.total, 'add')
      }

      await ctx.commit()

      return ResponseFormatter.create({
        message: 'opération effectuée avec succès',
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
}
