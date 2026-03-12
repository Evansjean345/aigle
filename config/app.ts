import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'

export const appEnv = env.get('NODE_ENV', 'development')

/**
 * Represents the deep link URL used for mobile devices.
 *
 * The value of this variable is expected to be a string containing a valid URL,
 * and it is intended to be platform-specific for mobile device navigation.
 */
export const mobileDeviceDeepLink = env.get('MOBILE_DEVICE_DEEP_LINK_URL')

/**
 * Represents the maximum number of device connections allowed.
 * The value is retrieved from the environment variable 'MAX_DEVICE_CONNECTIONS'.
 * If the environment variable is not set, a default value of 2 is used.
 *
 * @type {number}
 */
export const maxDeviceConnectionAllowed: number = env.get('MAX_DEVICE_CONNECTIONS', 2)

/**
 * A configuration flag that determines whether OTP (One-Time Password) verification should be bypassed.
 *
 * This flag is typically used for testing/development purposes where OTP verification
 * may need to be skipped. It's also used by google/apple to bypass OTP verification during app review.
 * Use with caution in production environments to maintain security.
 *
 * @type {boolean}
 */
export const bypassEnabled: boolean = env.get('BYPASS_OTP_VERIFICATION', false)

/**
 * Represents the phone number used for application review purposes.
 * The value is retrieved from an environment variable `APP_REVIEW_PHONE_NUMBER`.
 * If the environment variable is not set, a default phone number is used.
 *
 * @type {string}
 */
export const appPhoneNumberReview: string = env.get('APP_REVIEW_PHONE_NUMBER', '0768357397')

export const adminDashboardUrl: string = env.get('ADMIN_DASHBOARD_URL', 'http://localhost:3000')

/**
 * The configuration settings used by the HTTP server
 */
export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,

  /**
   * Enabling async local storage will let you access HTTP context
   * from anywhere inside your application.
   */
  useAsyncLocalStorage: false,

  /**
   * Manage cookies configuration. The settings for the session id cookie are
   * defined inside the "config/session.ExpoPushNotificationChannel" file.
   */
  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
})
