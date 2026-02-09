import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',

  /**
   * The loggers object can be used to define multiple loggers.
   * By default, we configure only one logger (named "app").
   */
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'info',
            options: {
              file: app.makePath('logs/app.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    transaction: {
      enabled: true,
      name: `${env.get('APP_NAME')}-transaction`,
      level: 'info',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'info',
            options: {
              file: app.makePath('logs/transaction.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    security: {
      enabled: true,
      name: `${env.get('APP_NAME')}-security`,
      level: 'info',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'info',
            options: {
              file: app.makePath('logs/security.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    payments_external: {
      enabled: true,
      name: `${env.get('APP_NAME')}-payments-ext`,
      level: 'info',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'info',
            options: {
              file: app.makePath('logs/payments_external.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    audit_ledger: {
      enabled: true,
      name: `${env.get('APP_NAME')}-ledger`,
      level: 'info',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'info',
            options: {
              file: app.makePath('logs/audit_ledger.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    transfers_internal: {
      enabled: true,
      name: `${env.get('APP_NAME')}-transfers-int`,
      level: 'info',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'info',
            options: {
              file: app.makePath('logs/transfers_internal.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    notifications: {
      enabled: true,
      name: `${env.get('APP_NAME')}-notifications`,
      level: 'info',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'info',
            options: {
              file: app.makePath('logs/notifications.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    kyc_documents: {
      enabled: true,
      name: `${env.get('APP_NAME')}-kyc`,
      level: 'info',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'info',
            options: {
              file: app.makePath('logs/kyc_documents.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    error: {
      enabled: true,
      name: `${env.get('APP_NAME')}-error`,
      level: 'error',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'error',
            options: {
              file: app.makePath('logs/error.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
    debug: {
      enabled: true,
      name: `${env.get('APP_NAME')}-debug`,
      level: 'debug',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .push({
            target: 'pino-roll',
            level: 'debug',
            options: {
              file: app.makePath('logs/debug.log'),
              mkdir: true,
            },
          })
          .toArray(),
      },
    },
  },
})

export default loggerConfig

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
