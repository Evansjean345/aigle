import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { Logger } from '@adonisjs/core/logger'
import env from '#start/env'
import { inject } from '@adonisjs/core'

export type HttpClientMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface HttpRequestOptions {
  uri: string
  method?: HttpClientMethod
  headers?: Record<string, string>
  data?: any
  params?: Record<string, any>
  timeout?: number
  retries?: number
}

export interface HttpResponse<T = any> {
  success: true
  data: T
  statusCode: number
  duration: number
}

/**
 * Represents an HTTP error response structure.
 *
 * This interface is used to encapsulate information about errors
 * encountered during an HTTP request or operation. It provides
 * details such as a success flag, error information, and request
 * duration.
 *
 * Properties:
 * - `success`: Indicates the success status of the HTTP operation (`false`).
 * - `error`: Contains error-specific details, including:
 *    - `message`: A descriptive message of the error.
 *    - `code`: A unique or specific error code identifier.
 *    - `statusCode` (optional): The HTTP status code associated with the error.
 *    - `details` (optional): Any additional data or context related to the error.
 * - `duration`: Represents the total time taken (in milliseconds) for the HTTP operation.
 */
export interface HttpErrorResponse {
  success: false
  error: {
    message: string
    code: string
    statusCode?: number
    details?: any
    retryable?: boolean
  }
  duration: number
}

/**
 * Represents the response received from an HTTP client. This can either be a successful
 * response containing the data or an error response detailing the failure reason.
 *
 * @template T - Specifies the type of the data expected in a successful HTTP response.
 *                Defaults to `any` if not explicitly provided.
 *
 */
export type HttpResult<T = any> = HttpResponse<T> | HttpErrorResponse

/**
 * Represents an error that occurs during an HTTP client operation.
 * Extends the built-in `Error` class to include additional context about the error.
 */
export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'HttpClientError'
  }
}

@inject()
export default class HttpClient {
  private readonly client: AxiosInstance
  private readonly defaultTimeout: number = 30_000
  private readonly defaultRetries: number = 0

  constructor(private readonly logger: Logger) {
    this.client = this.createClient()
    this.setupInterceptors()
  }

  /**
   * Creates and configures an Axios client instance with predefined settings.
   *
   * @return {AxiosInstance} A configured Axios client instance with base URL, timeout, and default headers set.
   */
  private createClient(): AxiosInstance {
    return axios.create({
      baseURL: env.get('API_BASE_URL'),
      timeout: this.defaultTimeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Determines whether an error is retryable based on the provided Axios error object.
   *
   * @param {AxiosError} error - The Axios error object to evaluate.
   * @return {boolean} Returns true if the error is retryable (e.g., no response or server error status code), otherwise false.
   */
  private isRetryable(error: AxiosError): boolean {
    if (!error.response) return true
    return error.response.status >= 500
  }

  /**
   * Calculates the backoff time based on the number of retries left.
   *
   * @param {number} retriesLeft - The number of retries remaining.
   * @return {number} The calculated backoff time in milliseconds.
   */
  private calculateBackoff(retriesLeft: number): number {
    const attempt = this.defaultRetries - retriesLeft + 1
    return Math.min(1000 * Math.pow(2, attempt - 1), 10_000)
  }

  /**
   * Pauses the execution of the program for the specified amount of time.
   *
   * @param {number} ms - The duration to sleep, in milliseconds.
   * @return {Promise<void>} A promise that resolves after the specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Configures request and response interceptors for the Axios client.
   *
   * The method sets up the following:
   * - Adds headers such as Authorization, MarchandId, and X-Request-ID to every request.
   * - Handles request errors and passes them through a rejection.
   * - Logs response errors and passes them through a rejection.
   *
   * @return {void} Does not return a value.
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        config.headers.set('Authorization', `Bearer ${env.get('AIGLE_HUB_SECRET')}`)
        config.headers.set('MarchandId', env.get('AIGLE_HUB_API_KEY'))
        config.headers.set('X-Request-ID', this.generateRequestId())

        return config
      },
      (error: AxiosError) => Promise.reject(error)
    )

    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        this.logError(error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Handles errors encountered during an HTTP request and returns a structured error response.
   *
   * @param {unknown} error - The error object thrown during the HTTP request. This can include Axios errors or other types of errors.
   * @param {number} duration - The duration (in milliseconds) of the action that caused the error.
   * @return {HttpErrorResponse} A structured response that contains details about the error, including a success flag, error information, and the action duration.
   */
  private handleError(error: unknown, duration: number): HttpErrorResponse {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>

      if (axiosError.response) {
        const isRetryable = this.isRetryable(axiosError)

        return {
          success: false,
          error: {
            message: axiosError.response.data?.message || axiosError.message,
            code: 'API_ERROR',
            statusCode: axiosError.response.status,
            details: axiosError.response.data,
            retryable: isRetryable,
          },
          duration,
        }
      }

      if (axiosError.code === 'ECONNABORTED') {
        return {
          success: false,
          error: {
            message: 'La requête a expiré',
            code: 'TIMEOUT',
            retryable: true,
          },
          duration,
        }
      }

      return {
        success: false,
        error: {
          message: 'Erreur de connexion au serveur',
          code: 'NETWORK_ERROR',
          retryable: true,
        },
        duration,
      }
    }

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Erreur inconnue',
        code: 'UNKNOWN_ERROR',
        retryable: false,
      },
      duration,
    }
  }

  /**
   * Logs detailed information about an Axios error.
   *
   * @param {AxiosError} error The error object returned by an Axios request.
   * @return {void} Does not return any value.
   */
  private logError(error: AxiosError): void {
    const context = {
      url: error.config?.url,
      method: error.config?.method,
      statusCode: error.response?.status,
      errorCode: error.code,
      message: error.message,
    }

    if (error.response?.status && error.response.status >= 500) {
      this.logger.error(context, 'HTTP request failed with server error')
    } else {
      this.logger.warn(context, 'HTTP request failed')
    }
  }

  /**
   * Generates a unique request identifier by combining the current timestamp
   * and a randomized alphanumeric string.
   *
   * @return {string} A string representing the uniquely generated request ID.
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Sends an HTTP request with the specified options and manages retries in case of failure.
   *
   * @param {HttpRequestOptions} options - Configuration object for the HTTP request, including URI, method, headers, data, params, timeout, and retries.
   *    @property {string} uri - The URI to send the request to.
   *    @property {string} [method='GET'] - The HTTP method to use (e.g., GET, POST, PUT).
   *    @property {Record<string, string>} [headers={}] - Headers to include in the request.
   *    @property {any} [data] - The payload to send with the request (used for methods like POST or PUT).
   *    @property {Record<string, any>} [params] - Query parameters to include in the request URL.
   *    @property {number} [timeout] - The maximum time, in milliseconds, to wait for the request to complete.
   *    @property {number} [retries] - The number of retry attempts in case the request fails.
   * @template T The expected type of the response data.
   * @return {Promise<HttpResult<T>>} A promise that resolves to an object containing the HTTP response status, data, and request duration. In case of failure, it includes error details.
   */
  async request<T = any>(options: HttpRequestOptions): Promise<HttpResult<T>> {
    const startTime = Date.now()
    const {
      uri,
      method = 'GET',
      headers = {},
      data,
      params,
      timeout,
      retries = this.defaultRetries,
    } = options

    const config: AxiosRequestConfig = {
      url: uri,
      method,
      headers,
      data,
      params,
      timeout: timeout ?? this.defaultTimeout,
    }

    try {
      const response = await this.executeWithRetry<T>(config, retries)
      const duration = Date.now() - startTime

      this.logger.debug(
        { uri, method, duration, statusCode: response.status },
        'HTTP request successful'
      )

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return this.handleError(error, duration)
    }
  }

  /**
   * Makes an HTTP request and throws an error if the request is not successful.
   *
   * @param {HttpRequestOptions} options - The configuration options for the HTTP request.
   * @return {Promise<T>} A promise that resolves to the response data if the request is successful.
   * @throws {HttpClientError} If the request fails, an error including details about the failure is thrown.
   */
  async requestOrThrow<T = any>(options: HttpRequestOptions): Promise<T> {
    const result = await this.request<T>(options)

    if (!result.success) {
      throw new HttpClientError(
        result.error.message,
        result.error.code,
        result.error.statusCode,
        result.error.details
      )
    }

    return result.data
  }

  /**
   * Executes an HTTP request with retry logic, attempting the specified number of retries in case of retryable errors.
   *
   * @param {AxiosRequestConfig} config - The Axios request configuration object containing request details such as URL, headers, params, and data.
   * @param {number} retriesLeft - The number of retries remaining. The method will decrement this value with each retry attempt.
   * @return {Promise<AxiosResponse<T>>} A promise that resolves to the Axios response object if the request is successful, or rejects with an error if all retry attempts fail.
   */
  private async executeWithRetry<T>(
    config: AxiosRequestConfig,
    retriesLeft: number
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.client.request<T>(config)
    } catch (error) {
      if (retriesLeft > 0 && this.isRetryable(error as AxiosError)) {
        const delay = this.calculateBackoff(retriesLeft)

        this.logger.warn({ uri: config.url, retriesLeft, delay }, 'Request failed, retrying...')

        await this.sleep(delay)
        return this.executeWithRetry<T>(config, retriesLeft - 1)
      }
      throw error
    }
  }

  /**
   * Sends a GET request to the specified URI with optional query parameters.
   *
   * @param {string} uri - The endpoint URI to send the request to.
   * @param {Record<string, any>} [params] - Optional query parameters to include in the request.
   * @return {Promise<HttpResult<T>>} A promise that resolves to the HTTP result containing the response data.
   * @template T The expected response data type.
   */
  async get<T = any>(uri: string, params?: Record<string, any>): Promise<HttpResult<T>> {
    return this.request<T>({ uri, method: 'GET', params })
  }

  /**
   * Sends an HTTP POST request to the specified URI with the provided data.
   *
   * @param {string} uri - The endpoint to which the POST request is sent.
   * @param {Record<string, any>} [data] - An optional object containing the data to be sent in the request body.
   * @return {Promise<HttpResult<T>>} A promise that resolves to the result of the HTTP request.
   */
  async post<T = any>(uri: string, data?: Record<string, any>): Promise<HttpResult<T>> {
    return this.request<T>({ uri, method: 'POST', data })
  }

  /**
   * Sends an HTTP PUT request to the specified URI with the provided data.
   *
   * @param {string} uri - The URI to which the PUT request will be sent.
   * @param {Record<string, any>} [data] - The payload to include in the PUT request. Optional.
   * @return {Promise<HttpResult<T>>} A promise that resolves to the result of the HTTP request.
   */
  async put<T = any>(uri: string, data?: Record<string, any>): Promise<HttpResult<T>> {
    return this.request<T>({ uri, method: 'PUT', data })
  }

  /**
   * Sends an HTTP PATCH request to the specified URI with the provided data payload.
   *
   * @param {string} uri - The endpoint to which the PATCH request will be sent.
   * @param {Record<string, any>} [data] - The data to be included in the body of the PATCH request.
   * @return {Promise<HttpResult<T>>} A promise that resolves to the result of the HTTP request.
   */
  async patch<T = any>(uri: string, data?: Record<string, any>): Promise<HttpResult<T>> {
    return this.request<T>({ uri, method: 'PATCH', data })
  }

  /**
   * Sends an HTTP DELETE request to the specified URI.
   *
   * @param {string} uri - The URI to send the DELETE request to.
   * @return {Promise<HttpResult<T>>} A promise that resolves to the result of the HTTP request.
   */
  async delete<T = any>(uri: string): Promise<HttpResult<T>> {
    return this.request<T>({ uri, method: 'DELETE' })
  }
}
