import PaymentMethod from '#features/catalogs/domain/models/payment_method'

export interface ListPaymentMethodsParams {
  page?: number
  limit?: number
  q?: string
}

/**
 * Abstract repository class for managing PaymentMethod entities.
 *
 * This class declares the interface for operations related to payment methods, including
 * pagination, retrieval by identifier or code, creation, updating, and deletion. Concrete
 * implementations of this class are expected to provide the functionality.
 */
export default abstract class PaymentMethodRepository {
  /**
   * Paginates through a list of payment methods based on the provided parameters.
   *
   * @param {ListPaymentMethodsParams} params - The parameters specifying pagination and filtering options for fetching the payment methods.
   * @return {Promise<any>} A promise that resolves with the paginated list of payment methods.
   */
  abstract paginate(params: ListPaymentMethodsParams): Promise<any>

  /**
   * Retrieves a PaymentMethod object by its unique identifier.
   * Throws an error if no PaymentMethod is found with the given ID.
   *
   * @param {number} id - The unique identifier of the PaymentMethod to retrieve.
   * @return {Promise<PaymentMethod>} A promise that resolves to the found PaymentMethod object.
   */
  abstract findByIdOrFail(id: number): Promise<PaymentMethod>

  /**
   * Retrieves a payment method by its unique code.
   *
   * @param {string} code - The unique code of the payment method to retrieve.
   * @return {Promise<PaymentMethod>} A promise that resolves to the payment method if found, or null if no matching payment method exists.
   */
  abstract findByCode(code: string): Promise<PaymentMethod>

  /**
   * Creates a new payment method using the provided data.
   *
   * @param {Object} data - An object containing the details of the payment method to be created.
   * @param {string} data.code - The unique code identifying the payment method.
   * @param {string} data.label - The label or name of the payment method.
   * @return {Promise<PaymentMethod>} A promise that resolves to the created PaymentMethod instance.
   */
  abstract create(data: { code: string; label: string }): Promise<PaymentMethod>

  /**
   * Updates the details of an existing payment method based on the provided ID and data.
   *
   * @param {number} id - The unique identifier of the payment method to be updated.
   * @param {Partial<{ code: string, label: string }>} data - An object containing the partial properties to update for the payment method.
   * @return {Promise<PaymentMethod>} A promise that resolves to the updated payment method object.
   */
  abstract update(
    id: number,
    data: Partial<{ code: string; label: string }>
  ): Promise<PaymentMethod>
  abstract delete(id: number): Promise<void>
}
