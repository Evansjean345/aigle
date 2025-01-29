import { inject } from '@adonisjs/core'
import TransactionRepository from '#repositories/transaction_repository'
import ResponseFormatter from '#responses/response_formatter'
// import { DateTime } from 'luxon'
import { AirtimeType, NewOperationType } from '#interfaces/operation'
import { makeRequest } from '../helpers/http_helpers.js'
import Wallet from '#models/wallet'
import PaymentRepository from '#repositories/payment_repository'
import db from '@adonisjs/lucid/services/db'

@inject()
export default class OperationService {
  constructor(
    protected transactionRepository: TransactionRepository,
    protected paymentRepository: PaymentRepository
  ) {}
  async updateBalance(wallet: Wallet, amount: number, operation: 'add' | 'subtract') {
    if (operation === 'add') {
      console.log('add')
      wallet.balance = Number(wallet.balance) + Number(amount)
    } else if (operation === 'subtract') {
      console.log('subtract')

      if (Number(wallet.balance) < Number(amount)) {
        return {
          status: false,
          messages: 'Solde insuffisant pour effectuer cette opération',
        }
      }
      wallet.balance = Number(wallet.balance) - Number(amount)
    } else {
      return {
        status: false,
        messages: 'Opération échoué ',
      }
    }

    await wallet.save()

    return {
      status: true,
      messages: 'La reussie',
    }
  }
  async depot(data: NewOperationType, auth: any) {
    const ctx = await db.beginGlobalTransaction()
    console.log('depot init')

    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet

      // enregistrer la transaccion
      let transaction = await this.create_transaction(user, wallet, data)
      if (transaction.error) {
        await ctx.rollback()
        return transaction
      }
      // enregistrer le payment
      let payment = await this.create_payment(transaction?.data, data)
      if (payment.error) {
        await ctx.rollback()
        return payment
      }

      // envoyer les données au service aigle hub
      let dataSend = {
        operation_type: payment?.data?.payment_method,
        amount: payment?.data?.total_amount,
        provider: payment?.data?.payment_details?.operator,
        number: payment?.data?.payment_details?.debiteur_phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction?.data?.reference,
        notify_success_url: process.env.NOTIFY_DEPOSIT_SUCCESS_URL,
        notify_failure_url: process.env.NOTIFY_DEPOSIT_FAILURE_URL,
      }

      if (
        payment?.data?.payment_details?.operator === 'orange' &&
        payment?.data?.payment_details?.pincode
      ) {
        dataSend.otp = payment?.data?.payment_details?.pincode
      } else if (
        payment?.data?.payment_details?.operator === 'orange' &&
        !payment?.data?.payment_details?.pincode
      ) {
        return ResponseFormatter.create({
          message: 'Le code temporaire orange money est requis',
          code: 400,
          status: false,
          error: true,
        })
      }

      if (payment?.data?.payment_details?.operator === 'wave') {
        dataSend.success_url = 'https://ednashoppinggroup.com/#/'
        dataSend.error_url = 'https://ednashoppinggroup.com/#/'
      }

      let response = await this.hub_service(process.env.API_CHECKOUT_URL, 'post', dataSend)

      if (response?.error) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: "Une erreur lors de l'initialisation du dépot",
          code: 500,
          status: false,
          error: response,
        })
      }

      // Commit de la transaction globale si tout se passe bien
      await ctx.commit()

      return ResponseFormatter.create({
        message: 'Initialisation du dépôt éffectuée',
        code: 200,
        status: true,
        error: false,
        data: response?.data,
      })
    } catch (err) {
      await ctx.rollback()

      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation du dépôt",
        code: 500,
        status: false,
        error: err,
      })
    }
  }
  async transfert(data: NewOperationType, auth: any) {
    const ctx = await db.beginGlobalTransaction()
    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet

      // verifier si le solde est suffisant
      if (Number(wallet.balance) < Number(data.total_amount)) {
        return ResponseFormatter.create({
          message: "vous n'avez pas de font suffisant pour effectuer cette operation",
          code: 401,
          status: false,
          error: true,
        })
      }

      // enregistrer la transaccion
      let transaction = await this.create_transaction(user, wallet, data)
      if (transaction.error) {
        await ctx.rollback()
        return transaction
      }
      // enregistrer le payment
      let payment = await this.create_payment(transaction?.data, data)
      if (payment.error) {
        await ctx.rollback()
        return payment
      }

      // envoyer les données au service aigle hub
      let dataSend = {
        operation_type: payment?.data?.payment_method,
        amount: payment?.data?.total_amount,
        provider: payment?.data?.payment_details?.operator,
        number: payment?.data?.payment_details?.beneficiaire_phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction?.data?.reference,
      }
      console.log(payment?.data)

      if (payment?.data?.payment_details?.operator !== 'wave') {
        dataSend.notify_success_url = process.env.NOTIFY_SUCCESS_URL
        dataSend.notify_failure_url = process.env.NOTIFY_FAILURE_URL
      }

      const walletUpdate = await this.updateBalance(wallet, payment?.data?.total_amount, 'subtract')
      if (!walletUpdate?.status) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
          code: 500,
          status: false,
          error: true,
        })
      }

      let response = await this.hub_service(process.env.API_TRANSFERT_URL, 'post', dataSend)
      // console.log(response?.error);

      if (response?.error) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: "Une erreur lors de l'initialisation du transfert",
          code: 500,
          status: false,
          error: response?.error,
        })
      }

      if (payment?.data?.payment_details?.operator === 'wave') {
        await this.update_data_operation_success(response?.data)
      }

      await ctx.commit()

      return ResponseFormatter.create({
        data: transaction,
        message:
          payment?.data?.payment_details?.operator === 'wave'
            ? 'Transfert éffectué avec succès'
            : 'Initialisation du transfert effectuée',
        code: 200,
        status: true,
        error: false,
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

  async airtime(data: AirtimeType, auth: any) {
    const ctx = await db.beginGlobalTransaction()
    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet

      // verifier si le solde est suffisant
      if (Number(wallet.balance) < Number(data.amount)) {
        return ResponseFormatter.create({
          message: "vous n'avez pas de font suffisant pour effectuer cette operation",
          code: 401,
          status: false,
          error: true,
        })
      }

      // enregistrer la transaccion
      let transaction = await this.create_transaction(user, wallet, data)
      if (transaction.error) {
        await ctx.rollback()
        return transaction
      }

      // enregistrer le payment et les détails de paiement
      let payment = await this.create_payment(transaction?.data, data)
      if (payment.error) {
        await ctx.rollback()
        return payment
      }

      // envoyer les données au service aigle hub
      let dataSend = {
        operation_type: payment?.data?.payment_method,
        amount: payment?.data?.total_amount,
        provider: payment?.data?.payment_details?.operator,
        number: payment?.data?.payment_details?.beneficiaire_phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction?.data?.reference,
      }
      console.log(payment?.data)

      if (payment?.data?.payment_details?.operator !== 'wave') {
        dataSend.notify_success_url = process.env.NOTIFY_SUCCESS_URL
        dataSend.notify_failure_url = process.env.NOTIFY_FAILURE_URL
      }

      const walletUpdate = await this.updateBalance(wallet, payment?.data?.total_amount, 'subtract')
      if (!walletUpdate?.status) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
          code: 500,
          status: false,
          error: true,
        })
      }

      let response = await this.hub_service(process.env.API_AIRTIME_URL, 'post', dataSend)
      // console.log(response?.error);

      if (response?.error) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: "Une erreur lors de l'initialisation du transfert",
          code: 500,
          status: false,
          error: response?.error,
        })
      }

      if (payment?.data?.payment_details?.operator === 'wave') {
        await this.update_data_operation_success(response?.data)
      }

      await ctx.commit()

      return ResponseFormatter.create({
        data: transaction,
        message:
          payment?.data?.payment_details?.operator === 'wave'
            ? 'Transfert éffectué avec succès'
            : 'Initialisation du transfert effectuée',
        code: 200,
        status: true,
        error: false,
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

  async transfert_inter_init_deposit(data: any, auth: any) {
    const ctx = await db.beginGlobalTransaction()

    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet

      if (data?.debitaire?.operator === 'orange' && !data?.debitaire?.pincode) {
        return ResponseFormatter.create({
          message: 'Le code temporaire orange money est requis',
          code: 400,
          status: false,
          error: true,
        })
      }

      let transaction = await this.create_transaction(user, wallet, {
        ...data?.debitaire,
        operation_type: 'transfer_inter',
      })

      if (transaction.error) {
        await ctx.rollback()
        return transaction
      }

      // enregistrer le payment de la recuperation de font
      let paymentDepotInit = await this.create_payment(transaction?.data, {
        ...data?.debitaire,
        step: 'deposit_init',
      })

      if (paymentDepotInit.error) {
        await ctx.rollback()
        return paymentDepotInit
      }

      // enregistrer le payment du transfert de font au brouillont
      let paymentTrasnferInit = await this.create_payment(transaction?.data, {
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
        amount: Number(paymentDepotInit?.data?.total_amount),
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

      let response = await this.hub_service(process.env.API_CHECKOUT_URL, 'post', dataSend)

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
        amount: paymentData.total_amount,
        provider: paymentData.payment_details?.operator,
        number: paymentData.payment_details?.beneficiaire_phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction.reference,
      }

      await paymentData.save()

      if (paymentData?.payment_details?.operator !== 'wave') {
        dataSend.notify_success_url = process.env.NOTIFY_TRANSFERT_INTER_SUCCESS_URL
        dataSend.notify_failure_url = process.env.NOTIFY_TRANSFERT_INTER_FAILURE_URL
      }

      const walletUpdate = await this.updateBalance(wallet, paymentData?.total_amount, 'subtract')
      if (!walletUpdate?.status) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
          code: 500,
          status: false,
          error: true,
        })
      }

      let response = await this.hub_service(process.env.API_TRANSFERT_URL, 'post', dataSend)

      if (response?.error) {
        await this.update_data_operation_failure({ reference: paymentData.transactions_uid })
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
        await this.update_data_operation_success(response?.data)
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

  async create_transaction(user: any, wallet: any, data: any) {
    // creation de la transaction
    const transactionData = {
      users_id: user.id,
      users_uid: user.users_uid,
      amount: data.amount,
      total_amount: data?.total_amount,
      operation_type: data.operation_type,
      fees: data?.fees,
      balance_before: wallet.balance,
    }
    const transaction = await this.transactionRepository.create(transactionData)

    return transaction
  }

  async create_payment(transaction: any, data: any) {
    const paymentDetails = (item: any) => {
      let response = null
      switch (item.operation_type) {
        case 'deposit':
          response = {
            operator: item?.operator,
            debiteur_phone: item?.debiteur_phone && item?.debiteur_phone,
            beneficiaire_phone: item.beneficiaire_phone && item.beneficiaire_phone,
            beneficiaire_name: item.beneficiaire_name && item.beneficiaire_name,
            pincode: item?.pincode && item.pincode,
          }

          break

        case 'bank':
          response = {
            bank_name: item.bank_name && item.bank_name,
            account_number: item.account_number && item.account_number,
            beneficiary_name: item.beneficiary_name && item.beneficiary_name,
          }
          break

        case 'credit_card':
          response = {
            card_number: item.card_number && item.card_number,
            card_expiry_date: item.card_expiry_date && item.card_expiry_date,
            card_holder: item.card_holder && item.card_holder,
          }
          break
        case 'airtime':
          response = {
            operator_id: item.operator_id && item.operator_id,
            amount: item.amount && item.amount,
            country_code: item.country_code && item.country_code,
            phone_number: item.phone_number && item.phone_number,
          }
          break

        default:
          break
      }

      return response
    }

    const paymentData = {
      users_id: transaction?.users_id,
      users_uid: transaction?.users_uid,
      transactions_id: transaction?.id,
      transactions_uid: transaction?.transactions_uid,
      payment_method: data.payment_method,
      operation_type: data.operation_type,
      fees: data.fees,
      amount: data.amount,
      total_amount: data.total_amount,
      payment_details: data,
      step: data.step && data.step,
      status: data.status && data.status,
    }
    const payment = await this.paymentRepository.create(paymentData)

    return payment
  }

  async airtime_country_operator(request: any) {
    try {
      let response = await this.hub_service(
        `${process.env.API_AIRTIME_COUNTRY_URL}/${request.code}/operators?dataOnly=false&bundlesOnly=false&includeData=false&includeBundles=false`,
        'get',
        ''
      )
      return ResponseFormatter.create({
        data: response?.data,
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
      let response = await this.hub_service(process.env.API_AIRTIME_COUNTRY_URL, 'get', '')

      console.log(response)

      return ResponseFormatter.create({
        data: response?.data,
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

  async hub_service(uri: any, method: any, data: any) {
    let response = await makeRequest({
      uri: uri,
      method: method,
      data: data,
    })

    return response
  }
  async update_data_operation_success(response: any) {
    const ctx = await db.beginGlobalTransaction()
    try {
      // Récupération de la transaction avec les relations nécessaires
      const { transaction, payment, user, wallet } = await this.data_web_hook(response?.reference)

      if (!transaction) {
        return ResponseFormatter.create({
          message: 'Transaction, not found',
          code: 404,
          status: false,
          error: true,
          data: null,
        })
      }

      if (transaction.operation_type === 'transfer_inter') {
        // transfert_init
        let paymentDebitaire = payment[0]
        let paymentBeneficiaire = payment[1]

        if (transaction.status === 'pending' && paymentDebitaire.status === 'pending') {
          paymentDebitaire.status = 'success'
          paymentDebitaire.operator_response = JSON.stringify(response)
          await paymentDebitaire.useTransaction(ctx).save()
          // Mise à jour du portefeuille
          const walletUpdate = await this.updateBalance(
            wallet,
            paymentDebitaire?.total_amount,
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
          transaction.balance_after = wallet.balance
        }

        if (transaction.status === 'pending' && paymentBeneficiaire.status === 'pending') {
          paymentBeneficiaire.status = 'success'
          paymentBeneficiaire.operator_response = JSON.stringify(response)
          await paymentBeneficiaire.useTransaction(ctx).save()
          transaction.balance_after = wallet.balance
        } else if (paymentBeneficiaire.status === 'draft') {
          paymentBeneficiaire.status = 'pending'
          await paymentBeneficiaire.useTransaction(ctx).save()
        }

        if (paymentBeneficiaire.status === 'success' && paymentDebitaire.status === 'success') {
          transaction.status = 'success'
        }

        await transaction.useTransaction(ctx).save()
      } else {
        let PaymentData = payment[0]

        if (transaction.status === 'pending') {
          PaymentData.status = 'success'
          PaymentData.operator_response = JSON.stringify(response)
          await PaymentData.useTransaction(ctx).save()
          // Mise à jour du portefeuille

          if (PaymentData?.operation_type === 'deposit') {
            const walletUpdate = await this.updateBalance(wallet, PaymentData?.total_amount, 'add')
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

          // Mise à jour de la transaction
          transaction.balance_after = wallet.balance
          transaction.status = 'success'
          await transaction.useTransaction(ctx).save()
        }
      }

      await ctx.commit()

      return ResponseFormatter.create({
        message:
          transaction?.operation_type === 'deposit'
            ? 'Dépôt effectué avec succès'
            : 'Transfert effectué avec succès',
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

      console.error('Error in update_data_operation_success:', error)

      return ResponseFormatter.create({
        message: "Une erreur s'est produite lors de l'opération",
        code: 500,
        status: false,
        error: error.message || error,
      })
    }
  }
  async update_data_operation_failure(response: any) {
    const ctx = await db.beginGlobalTransaction()

    try {
      // Récupération de la transaction avec les relations nécessaires
      let { transaction, payment, user, wallet } = await this.data_web_hook(response?.reference)

      if (!transaction || !payment || !user || !wallet) {
        return ResponseFormatter.create({
          message: 'Transaction, Payment, User or Wallet not found',
          code: 404,
          status: false,
          error: true,
          data: false,
        })
      }

      // Mise à jour de la transaction
      transaction.status = 'failed'
      transaction.balance_after = wallet.balance
      await transaction.useTransaction(ctx).save()

      // Mise à jour du paiement
      for (const element of payment) {
        if (element.status === 'pending') {
          element.status = 'failed'
          element.operator_response = JSON.stringify(response)
          await element.useTransaction(ctx).save() // Attendre chaque save
        }
      }
      await ctx.commit()

      return ResponseFormatter.create({
        message:
          transaction?.operation_type === 'deposit' ? 'Le dépot a échoué' : 'Le transfert a échoué',
        code: 400,
        status: false,
        error: true,
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
        message: 'Une erreur lors du transfert',
        code: 500,
        status: false,
        error: error,
      })
    }
  }

  async data_web_hook(reference: any) {
    let transactionResponse =
      await this.transactionRepository.get_detail_by_uid_or_reference(reference)
    let transaction = transactionResponse?.data
    let payment = transaction?.payment
    let user = transaction?.user
    let wallet = user?.wallet

    return {
      transaction,
      payment,
      wallet,
      user,
    }
  }
}
