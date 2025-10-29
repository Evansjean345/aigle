import { Expo } from 'expo-server-sdk'
import { Exception } from '@adonisjs/core/exceptions'

export default class ExpoPushNotificationService {
  #expoInstance: Expo
  #pushTokens: Set<string> = new Set()
  #body: string = ''
  #title: string = ''
  #data: Record<any, any> = {}

  constructor() {
    this.#expoInstance = new Expo()
  }

  setPushToken(token: string | string[]) {
    if (Array.isArray(token)) {
      token.forEach((t) => this.#pushTokens.add(t))
      return this
    }

    this.#pushTokens.add(token)
    return this
  }

  setTitle(title: string) {
    this.#title = title
    return this
  }

  setBody(message: string) {
    this.#body = message
    return this
  }

  setData(data: Record<any, any>) {
    this.#data = data
    return this
  }

  async send() {
    if (!this.#title) {
      throw new Exception('Title is required', {
        status: 400,
        code: 'TITLE_IS_REQUIRED',
      })
    }

    if (!this.#body) {
      throw new Exception('Body is required', {
        status: 400,
        code: 'BODY_IS_REQUIRED',
      })
    }

    if (this.#pushTokens.size === 0) {
      throw new Exception('No push tokens found', {
        status: 400,
        code: 'NO_PUSH_TOKENS_FOUND',
      })
    }

    const messages = []

    for (const token of this.#pushTokens) {
      if (Expo.isExpoPushToken(token)) {
        messages.push({
          to: token,
          title: this.#title,
          sound: 'default',
          body: this.#body,
          data: this.#data,
        })

        console.log(messages)
      }
    }

    const tickets = []

    try {
      const ticketChunk = await this.#expoInstance.sendPushNotificationsAsync(messages)
      tickets.push(...ticketChunk)
      console.log('Push notifications sent successfully')
      console.log(ticketChunk)
    } catch (error) {
      console.error('Error sending push notifications:', error)
    }

    return tickets
  }
}
