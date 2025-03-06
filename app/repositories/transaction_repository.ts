import { DepotType, TransactionType } from '#interfaces/transaction'
import Transaction from '#models/transaction'
import ResponseFormatter from '#responses/response_formatter'
import db from '@adonisjs/lucid/services/db'
import { TransactionInterface } from '../contracts/transaction_interface.js'

export default class TransactionRepository implements TransactionInterface {
  async create(data: DepotType) {
    const ctx = await db.transaction()

    try {
      const transaction = await Transaction.create(data)
      await ctx.commit()

      console.log('transaction cretaed')

      return ResponseFormatter.create({
        data: transaction,
        message: 'transaction créé avec succès',
        code: 201,
      })
    } catch (err) {
      await ctx.rollback()
      return ResponseFormatter.create({
        message: 'Erreur lors de la création de la transaction',
        code: 500,
        error: err,
        status: false,
      })
    }
  }

  async update(query: { uid: string; id: string }, data: TransactionType) {
    const ctx = await db.transaction()
    try {
      const transaction = await Transaction.query()
        .where('transactions_uid', query.uid)
        .orWhere('id', query.id)
        .first()

      if (!transaction) {
        return ResponseFormatter.create({
          data: null,
          message: 'trasaction non trouvé',
          code: 404,
          status: false,
        })
      }
      await transaction.merge(data).save()
      await ctx.commit()
      return ResponseFormatter.create({
        data: transaction,
        message: 'Mise à jour effectuée avec succès',
        code: 200,
      })
    } catch (err) {
      await ctx.rollback()
      return ResponseFormatter.create({
        message: 'Erreur lors de la mise à jour de la transaction',
        code: 500,
        error: err,
        status: false,
      })
    }
  }

  async get_all(filter: any = '') {
    try {
      const transactions = await Transaction.query()
        .if(filter.status, (query) => {
          query.where('status', filter.status)
        })
        .if(filter.status, (query) => {
          query.where('operation_type', filter.operation)
        })
        .preload('user', (userQuery) => {
          userQuery.select('firstname', 'lastname', 'account_number', 'phone')
        })
        .preload('payment')
        .orderBy('created_at', 'desc')

      return ResponseFormatter.create({
        data: transactions,
        message: 'listes des trasactions',
        code: 201,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuperation de la liste',
        code: 500,
        error: err,
        status: false,
      })
    }
  }

  async get_all_by_user(user) {
    try {
      const transaction = await user
        .related('transactions')
        .query()
        .preload('payment')
        .orderBy('created_at', 'desc')

      return ResponseFormatter.create({
        data: transaction,
        message: 'listes des trasactions',
        code: 201,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuperation de la liste',
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async get_detail_by_user(user: any, params: any) {
    try {
      // const transaction = await Transaction.findManyBy({
      //   id: params.transactionId,
      //   transactions_uid: params.transactionUid,
      //   users_id: user.id,
      // }).reload('payment')
      const transaction = await Transaction.query()
        .where('id', params.transactionId)
        .andWhere('transactions_uid', params.transactionUid)
        .andWhere('users_id', user.id)
        .preload('payment')

      return ResponseFormatter.create({
        data: transaction.length == 0 ? null : transaction[0],
        message: 'listes des trasactions',
        code: 200,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuperation de la liste',
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async get_by_uid_and_id(query: { uid: string; id: string }) {
    try {
      const transaction = await Transaction.query()
        .where('transactions_uid', query.uid)
        .orWhere('id', query.id)
        .first()

      return ResponseFormatter.create({
        data: transaction,
        message: 'listes des trasactions',
        code: 200,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuperation de la liste',
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async get_detail_by_uid_or_reference(transactionId: string) {
    try {
      const transaction = await Transaction.query()
        // .where('transactions_uid', transactionId)
        .orWhere('reference', transactionId)
        .preload('payment')
        .preload('user', (userQuery) => {
          userQuery.preload('wallet')
        })
        .first()

      return ResponseFormatter.create({
        data: transaction,
        message: 'listes des trasactions',
        code: 200,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuperation de la liste',
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }
  async get_detail_by_reference(user: any, reference: string) {
    try {
      const transaction = await Transaction.query()
        .andWhere('users_id', user.id)
        .where('reference', reference)
        .first()

      return ResponseFormatter.create({
        data: transaction,
        message: 'transaction details',
        code: 200,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuperation de la transaction',
        code: 500,
        error: err,
        status: false,
      })
    }
  }
}
