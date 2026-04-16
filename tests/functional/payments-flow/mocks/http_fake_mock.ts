import { type HttpResult } from '#shared/infrastructure/services/http_client_service'

/**
 * Fake HttpClient qui retourne des réponses configurables.
 */
export default class FakeHttpClient {
  private nextResponse: HttpResult | null = null
  private nextError: Error | null = null

  /** Simule une réponse d'erreur de l'agrégateur (API répond mais avec erreur) */
  simulateApiError(statusCode: number, message: string, details?: any) {
    this.nextResponse = {
      success: false,
      error: {
        message,
        code: 'API_ERROR',
        statusCode,
        details,
        retryable: statusCode >= 500,
      },
      duration: 50,
    }
  }

  /** Simule une erreur réseau (pas de réponse du serveur) */
  simulateNetworkError(code: string, message: string) {
    this.nextError = Object.assign(new Error(message), { code })
  }

  /** Simule un timeout */
  simulateTimeout() {
    this.nextError = Object.assign(new Error('Request timeout after 30000ms'), {
      code: 'ETIMEDOUT',
    })
  }

  /** Simule une réponse réussie */
  simulateSuccess(data: any = {}) {
    this.nextResponse = {
      success: true,
      data,
      statusCode: 200,
      duration: 50,
    }
  }

  async post(_uri: string, _data?: any): Promise<HttpResult> {
    if (this.nextError) {
      const err = this.nextError
      this.nextError = null
      throw err
    }

    const response = this.nextResponse!
    this.nextResponse = null
    return response
  }

  async get(_uri: string): Promise<HttpResult> {
    return this.post(_uri)
  }
}
