import ExpoPushNotificationService from '#shared/services/notification/expo_push_notification_service'

export default class PushNotificationController {
  constructor() {}

  async handle() {
    const expoPushNotificationService = new ExpoPushNotificationService()

    await expoPushNotificationService
      .setPushToken('ExponentPushToken[SuABFPEkJ6tIqVj4ZB_4rb]')
      .setTitle('Hello from Aiglesend server')
      .setBody('This is a test notification')
      .send()
  }
}
