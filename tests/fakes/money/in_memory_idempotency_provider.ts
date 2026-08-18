import type IdempotencyProvider from '#core/money/transactions/domain/interfaces/idempotency_provider'

/**
 * Clés d'idempotence, en mémoire.
 *
 * Implémente le port : une méthode ajoutée au contrat casse la compilation ici, en un seul endroit.
 * Les durées de validité sont ignorées — rien n'expire le temps d'un test.
 */
export default class InMemoryIdempotencyProvider implements IdempotencyProvider {
  private readonly keys = new Map<string, string>()

  /**
   * Marque une clé comme traitée.
   *
   * @param {string} key - La clé d'idempotence.
   * @param {number} [_ttlSeconds] - Durée de validité, ignorée ici.
   * @returns {Promise<boolean>} `true` si la clé est nouvelle, `false` si elle a déjà été vue.
   */
  async checkAndMark(key: string, _ttlSeconds?: number): Promise<boolean> {
    if (this.keys.has(key)) return false

    this.keys.set(key, '')

    return true
  }

  /**
   * Rend la valeur associée à une clé.
   *
   * @param {string} key - La clé d'idempotence.
   * @returns {Promise<string | null>} La valeur, ou `null` si la clé est inconnue.
   */
  async get(key: string): Promise<string | null> {
    return this.keys.get(key) ?? null
  }

  /**
   * Associe une valeur à une clé.
   *
   * @param {string} key - La clé d'idempotence.
   * @param {string} value - La valeur associée.
   * @param {number} [_ttlSeconds] - Durée de validité, ignorée ici.
   * @returns {Promise<void>} Rien.
   */
  async update(key: string, value: string, _ttlSeconds?: number): Promise<void> {
    this.keys.set(key, value)
  }

  /**
   * Libère une clé.
   *
   * @param {string} key - La clé d'idempotence.
   * @returns {Promise<void>} Rien.
   */
  async delete(key: string): Promise<void> {
    this.keys.delete(key)
  }
}
