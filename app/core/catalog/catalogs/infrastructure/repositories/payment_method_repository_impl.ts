import PaymentMethod from '#core/catalog/catalogs/domain/models/payment_method'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { type ListPaymentMethodsParams } from '#core/catalog/catalogs/domain/interfaces/payment_method_repository'
import type PaymentMethodRepository from '#core/catalog/catalogs/domain/interfaces/payment_method_repository'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * The `PaymentMethodRepository` class provides methods for managing
 * payment methods in a database. It implements the
 * `PaymentMethodRepositoryContract` interface.
 */
export default class PaymentMethodRepositoryImpl implements PaymentMethodRepository {
  /**
   * Paginates the list of payment methods based on the provided parameters.
   *
   * @param {ListPaymentMethodsParams} params - The parameters for pagination.
   * @param {number} [params.page=1] - The page number to retrieve.
   * @param {number} [params.limit=20] - The number of items per page.
   * @param {string} [params.q] - A search query to filter payment methods by code or label.
   * @return {Promise<Object>} A promise that resolves to the paginated result set.
   */
  async paginate(params: ListPaymentMethodsParams): Promise<ModelPaginatorContract<PaymentMethod>> {
    const { page = 1, limit = 20, q } = params
    const query = PaymentMethod.query().orderBy('id', 'desc')
    if (q) {
      query.where((builder) => {
        builder.whereILike('code', `%${q}%`).orWhereILike('label', `%${q}%`)
      })
    }
    return query.paginate(Number(page), Number(limit))
  }

  /**
   * Retrieves a payment method by its unique identifier. If no matching record is found, an error is thrown.
   *
   * @param {number} id - The unique identifier of the payment method to be retrieved.
   * @return {Promise<PaymentMethod>} A promise that resolves with the payment method corresponding to the provided ID or rejects with an error if not found.
   */
  findByIdOrFail(id: number): Promise<PaymentMethod> {
    return PaymentMethod.findOrFail(id)
  }

  /**
   * Creates a new payment method using the provided data.
   *
   * @param {Object} data - The information required to create a payment method.
   * @param {string} data.code - The unique code of the payment method.
   * @param {string} data.label - The label or name of the payment method.
   * @return {Promise<Object>} A promise that resolves to the newly created payment method.
   */
  async create(data: { code: string; label: string }): Promise<PaymentMethod> {
    return PaymentMethod.create(data)
  }

  /**
   * Retrieves a payment method by its unique code.
   *
   * @param {string} code - The unique code of the payment method to retrieve.
   * @return {Promise<PaymentMethod>} A promise that resolves to the payment method if found, or null if no matching payment method exists.
   */
  async findByCode(code: string): Promise<PaymentMethod> {
    const paymentMethod = await PaymentMethod.query().where('code', code).first()

    if (!paymentMethod) {
      throw new Exception("Ce type de paiement n'existe pas.", {
        status: 404,
        code: 'E_PAYMENT_METHOD_NOT_FOUND',
      })
    }

    return paymentMethod
  }

  /**
   * Updates a payment method entry with the provided data.
   *
   * @param {number} id - The unique identifier of the payment method to update.
   * @param {Partial<{ code: string; label: string }>} data - The partial data to update the payment method with. This can include the code and/or label.
   * @return {Promise<PaymentMethod>} The updated payment method instance.
   */
  async update(id: number, data: Partial<{ code: string; label: string }>): Promise<PaymentMethod> {
    const item = await PaymentMethod.findOrFail(id)
    item.merge(data)
    await item.save()
    return item
  }

  /**
   * Deletes the payment method identified by the provided ID.
   *
   * @param {number} id - The unique identifier of the payment method to be deleted.
   * @return {Promise<void>} A promise that resolves when the payment method is successfully deleted.
   */
  async delete(id: number): Promise<void> {
    const item = await PaymentMethod.findOrFail(id)
    await item.delete()
  }
}
