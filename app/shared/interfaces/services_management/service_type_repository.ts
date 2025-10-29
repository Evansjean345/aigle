import ServiceType from '#shared/models/service_type'

export interface ListServiceTypesParams {
  page?: number
  limit?: number
  q?: string
}

export default abstract class ServiceTypeRepository {
  /**
   * Abstract method to handle pagination for retrieving a list of service type parameters.
   *
   * @param {ListServiceTypesParams} params - The parameters required for pagination and filtering of the list.
   * @return {Promise<any>} A promise that resolves with the paginated data result.
   */
  abstract paginate(params: ListServiceTypesParams): Promise<any>

  /**
   * Finds an entity by its unique identifier. If the entity is not found, it throws an error.
   *
   * @param {number} id - The unique identifier of the entity to retrieve.
   * @return {Promise<ServiceType>} A promise that resolves to the entity of type ServiceType if found.
   */
  abstract findByIdOrFail(id: number): Promise<ServiceType>

  /**
   * Creates a new service type based on the provided data object.
   *
   * @param {Object} data - The data object containing details of the service type to create.
   * @param {string} data.code - The unique code identifying the service type.
   * @param {string} data.label - The label or name of the service type.
   * @param {string|null|undefined} [data.description] - An optional description of the service type.
   * @return {Promise<ServiceType>} A promise that resolves to the created service type.
   */
  abstract create(data: {
    code: string
    label: string
    description?: string | null
  }): Promise<ServiceType>

  /**
   * Updates the existing resource identified by the given id with the provided data.
   *
   * @param {number} id - The unique identifier of the resource to be updated.
   * @param {Partial<{code: string; label: string; description?: string | null}>} data - The partial data object containing updated properties for the resource.
   * @return {Promise<ServiceType>} A promise resolving to the updated resource.
   */
  abstract update(
    id: number,
    data: Partial<{ code: string; label: string; description?: string | null }>
  ): Promise<ServiceType>
  abstract delete(id: number): Promise<void>
}
