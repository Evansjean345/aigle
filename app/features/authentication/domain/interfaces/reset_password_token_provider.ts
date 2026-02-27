export default abstract class ResetPasswordTokenProvider {
  /**
   * Stores a temporary token for password reset.
   * @param phone The user's phone number.
   * @param token The generated token.
   * @param ttlSeconds Time to live in seconds.
   */
  abstract store(phone: string, token: string, ttlSeconds: number): Promise<void>

  /**
   * Verifies if the token is valid for the given phone number.
   * @param phone The user's phone number.
   * @param token The token to verify.
   * @returns True if valid, false otherwise.
   */
  abstract verify(phone: string, token: string): Promise<boolean>

  /**
   * Deletes the token after use.
   * @param phone The user's phone number.
   */
  abstract delete(phone: string): Promise<void>
}
