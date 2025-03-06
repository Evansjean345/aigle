import { inject } from '@adonisjs/core'
import TransactionRepository from '#repositories/transaction_repository'
import ResponseFormatter from '#responses/response_formatter'
// import { DateTime } from 'luxon'
import { AirtimeType, MobileMoneyCheckoutType, NewOperationType } from '#interfaces/operation'
import { makeRequest } from '../helpers/http_helpers.js'
import Wallet from '#models/wallet'
import PaymentRepository from '#repositories/payment_repository'
import db from '@adonisjs/lucid/services/db'
import { calculateFee } from '../helpers/fee_helpers.js'
import { generateUrl } from '../helpers/file_helpers.js'
import drive from '@adonisjs/drive/services/main'

@inject()
export default class OperationService {
  constructor(
    protected transactionRepository: TransactionRepository,
    protected paymentRepository: PaymentRepository
  ) { }
  // metter à jour le walllet d'un utilisateur
  async updateBalance(wallet: Wallet, amount: number, operation: 'add' | 'subtract') {
    if (operation === 'add') {
      console.log('add')
      wallet.balance = Number(wallet.balance) + Number(amount)
    } else if (operation === 'subtract') {
      console.log('subtract')
      if (Number(wallet.balance) < Number(amount)) {
        return {
          status: false,
          code: 422,
          messages: 'Solde insuffisant pour effectuer cette opération',
        }
      }
      wallet.balance = Number(wallet.balance) - Number(amount)
    } else {
      return {
        status: false,
        code: 500,
        messages: 'Opération échoué ',
      }
    }

    await wallet.save()

    return {
      status: true,
      messages: 'La reussie',
    }
  }

  // function pour effectuer un dépot vers le wallet
  async depot(data: NewOperationType, auth: any) {
    const ctx = await db.beginGlobalTransaction()
    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet

      // calcule des frais de transfert
      let result = await calculateFee(data?.amount, data?.operation_type, 'subtract')
      data.fees = result.fees
      data.total_amount = result.total

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
        amount: result?.amount,
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

  // function de retour du service depot pour la mise à jour des données
  async depot_callback(response: any, status: string) {
    const ctx = await db.beginGlobalTransaction()
    try {
      // Récupération de la transaction avec les relations nécessaires
      const { transaction, payment, user, wallet } = await this.data_web_hook(response?.reference)
      let paymentData = payment[0]

      if (status === 'success') {
        if (transaction.status === 'pending') {
          paymentData.status = 'success'
          paymentData.callback_status = true
          paymentData.operator_response = JSON.stringify(response)
          await paymentData.useTransaction(ctx).save()

          // Mise à jour du portefeuille
          const walletUpdate = await this.updateBalance(wallet, transaction?.total_amount, 'add')
          if (!walletUpdate?.status) {
            return ResponseFormatter.create({
              message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
              code: 500,
              status: false,
              error: true,
            })
          }
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

  async demande_virement(data: any, auth: any) {
    const ctx = await db.beginGlobalTransaction()
    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet
      let file = data.file('file')
      data = data.all()
      let path = user?.id + generateUrl(file.extname)
      // let result = await calculateFee(data.amount, data?.operation_type, 'subtract')

      await file.moveToDisk(`virement/${path}`)
      path = await drive.use('fs').getUrl(`virement/${path}`)
      data.file = path
      data.fees = 5000
      data.total_amount = Number(data.amount) - Number(data.fees)

      let transaction = await this.create_transaction(user, wallet, data)

      // enregistrer le payment
      let payment = await this.create_payment(transaction?.data, data)
      if (payment.error) {
        await ctx.rollback()
        return payment
      }
      await ctx.commit()

      return transaction
    } catch (error) {
      await ctx.rollback()

      console.log(error)

      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation du virement",
        code: 500,
        status: false,
        error: error,
      })
    }
  }

  // transferer de d'argent depuis le wallet
  async transfert(data: NewOperationType, auth: any) {
    const ctx = await db.beginGlobalTransaction()
    try {
      const user = auth.user
      await user.load('wallet')
      const wallet = user.wallet

      // verifier si le solde est suffisant
      if (Number(wallet.balance) < Number(data.amount)) {
        await ctx.rollback()
        return ResponseFormatter.create({
          message: "vous n'avez pas de font suffisant pour effectuer cette operation",
          code: 401,
          status: false,
          error: true,
        })
      }

      // calcule des frais de transfert
      let result = await calculateFee(data.amount, data?.operation_type, 'subtract')
      data.fees = result.fees
      data.total_amount = result.total
      console.log(data)

      // enregistrer la transaccion
      let transaction = await this.create_transaction(user, wallet, data)
      // console.log(transaction.error);

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
        amount: data?.total_amount,
        provider: payment?.data?.payment_details?.operator,
        number: payment?.data?.payment_details?.beneficiaire_phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction?.data?.reference,
      }

      if (payment?.data?.payment_details?.operator !== 'wave') {
        dataSend.notify_success_url = process.env.NOTIFY_SUCCESS_URL
        dataSend.notify_failure_url = process.env.NOTIFY_FAILURE_URL
      }

      const walletUpdate = await this.updateBalance(wallet, result?.amount, 'subtract')
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
        await this.transfert_callback(response?.data, 'failure')
        return ResponseFormatter.create({
          message: 'Une erreur lors du transfert',
          code: 500,
          status: false,
          error: response?.error,
        })
      }

      if (payment?.data?.payment_details?.operator === 'wave') {
        await this.transfert_callback(response?.data, 'success')
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
  // function de retour du service transfert pour la mise à jour des données
  async transfert_callback(response: any, status: string) {
    const ctx = await db.beginGlobalTransaction()
    try {
      // Récupération de la transaction avec les relations nécessaires
      const { transaction, payment, user, wallet } = await this.data_web_hook(response?.reference)
      let paymentData = payment[0]

      if (status === 'success') {
        if (transaction.status === 'pending') {
          paymentData.status = 'success'
          paymentData.callback_status = true
          paymentData.operator_response = JSON.stringify(response)
          await paymentData.useTransaction(ctx).save()
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
        paymentData.status = 'failed'
        paymentData.callback_status = true
        paymentData.operator_response = JSON.stringify(response)
        await paymentData.useTransaction(ctx).save()
        // Mise à jour du portefeuille
        const walletUpdate = await this.updateBalance(wallet, paymentData?.amount, 'add')
        if (!walletUpdate?.status) {
          return ResponseFormatter.create({
            message: walletUpdate?.message || 'échec lors de la mise à jour du wallet',
            code: 500,
            status: false,
            error: true,
          })
        }
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

  // effectuer un encaissement par mobile money pour crediter le wallet de l'utilisateur
  async mobile_money_checkout(data: MobileMoneyCheckoutType) {
    try {
      // envoyer les données au service aigle hub
      let dataSend: MobileMoneyCheckoutType = {
        operation_type: data?.operation_type,
        amount: data?.amount,
        provider: data?.provider,
        number: data?.number,
        country: 'ci',
        currency: 'XOF',
        reference: data?.reference,
        notify_success_url: data.notify_success_url,
        notify_failure_url: data.notify_failure_url,
      }

      if (data?.provider === 'orange' && data?.pincode) {
        dataSend.otp = data?.pincode
      } else if (data.provider === 'orange' && !data?.pincode) {
        return ResponseFormatter.create({
          message: 'Le code temporaire orange money est requis',
          code: 400,
          status: false,
          error: true,
        })
      }

      if (data?.provider === 'wave') {
        dataSend.success_url = 'https://ednashoppinggroup.com/#/'
        dataSend.error_url = 'https://ednashoppinggroup.com/#/'
      }

      let response = await this.hub_service(process.env.API_CHECKOUT_URL, 'post', dataSend)

      if (response?.error) {
        return ResponseFormatter.create({
          message: "Une erreur lors de l'initialisation du dépot",
          code: 500,
          status: false,
          error: response,
        })
      }
      // Commit de la transaction globale si tout se passe bien

      return ResponseFormatter.create({
        message: 'Initialisation du dépôt éffectuée',
        code: 200,
        status: true,
        error: false,
        data: response?.data,
      })
    } catch (error) {
      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation du dépôt",
        code: 500,
        status: false,
        error: error,
      })
    }
  }

  async aigle_checkout(amount: number, wallet: any) {
    try {
      const walletUpdate = await this.updateBalance(wallet, amount, 'subtract')
      if (!walletUpdate?.status) {
        return ResponseFormatter.create({
          message: walletUpdate?.messages,
          code: walletUpdate.code,
          status: false,
          error: true,
        })
      }

      return ResponseFormatter.create({
        message: 'wallet subtract',
        code: 200,
        status: true,
        error: false,
        data: walletUpdate?.data,
      })
    } catch (error) {
      return ResponseFormatter.create({
        message: 'Une erreur interne',
        code: 500,
        status: false,
        error: error,
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
      operation_type: data?.payment_details
        ? data?.payment_details?.operation_type
        : data.operation_type,
      fees: transaction.fees,
      amount: transaction.amount,
      total_amount: transaction.total_amount,
      payment_details: data?.payment_details ? data.payment_details : data,

      step: data.step && data.step,
      status: data.status && data.status,
    }
    const payment = await this.paymentRepository.create(paymentData)

    return payment
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

      if (
        transaction.operation_type === 'transfer_inter' ||
        transaction.operation_type === 'airtime'
      ) {
        // transfert_init
        let paymentDebitaire = payment[0]
        let paymentBeneficiaire = payment[1]

        if (transaction.status === 'pending' && paymentDebitaire.status === 'pending') {
          paymentDebitaire.status = 'success'
          paymentDebitaire.callback_status = true
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
          paymentBeneficiaire.callback_status = true
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
          PaymentData.callback_status = true
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
          element.callback_status = true
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
