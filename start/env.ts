import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  JWT_SECRET: Env.schema.string(),
  JWT_ALG: Env.schema.string(),

  CLOUDINARY_CLOUD_NAME: Env.schema.string(),
  CLOUDINARY_API_KEY: Env.schema.string(),
  CLOUDINARY_API_SECRET: Env.schema.string(),

  BYPASS_OTP_VERIFICATION: Env.schema.boolean(),
  APP_REVIEW_PHONE_NUMBER: Env.schema.string.optional(),

  MAX_DEVICE_CONNECTIONS: Env.schema.number(),

  MOBILE_DEVICE_DEEP_LINK_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the drive package
  |----------------------------------------------------------
  */
  DRIVE_DISK: Env.schema.enum(['fs', 's3'] as const),

  AWS_ACCESS_KEY_ID: Env.schema.string(),
  AWS_SECRET_ACCESS_KEY: Env.schema.string(),
  AWS_REGION: Env.schema.string(),
  S3_BUCKET: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the limiter package
  |----------------------------------------------------------
  */
  LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring MTarget SMS service
  |----------------------------------------------------------
  */
  MTARGET_URL: Env.schema.string(),
  MTARGET_USERNAME: Env.schema.string(),
  MTARGET_PASSWORD: Env.schema.string(),
  MTARGET_SENDER: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  SMTP_HOST: Env.schema.string(),
  SMTP_PORT: Env.schema.string(),
  SMTP_FROM_EMAIL: Env.schema.string.optional(),
  ADMIN_DASHBOARD_URL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring audit database connection (PostgreSQL)
  |----------------------------------------------------------
  */
  AUDIT_DB_HOST: Env.schema.string({ format: 'host' }),
  AUDIT_DB_PORT: Env.schema.number(),
  AUDIT_DB_USER: Env.schema.string(),
  AUDIT_DB_PASSWORD: Env.schema.string(),
  AUDIT_DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for @rlanz/bull-queue
  |----------------------------------------------------------
  */
  QUEUE_REDIS_HOST: Env.schema.string({ format: 'host' }),
  QUEUE_REDIS_PORT: Env.schema.number(),
  QUEUE_REDIS_PASSWORD: Env.schema.string.optional(),

  /*
 |----------------------------------------------------------
 | Variables for configuration maxmind database connection
 |----------------------------------------------------------
 */
  MAXMIND_LICENSE_KEY: Env.schema.string(),
  MAXMIND_DB_PATH: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring @adonisjs/queue
  |----------------------------------------------------------
  */
  QUEUE_DRIVER: Env.schema.enum(['redis', 'database', 'sync'] as const),

  APP_NAME: Env.schema.string(),
  APP_VERSION: Env.schema.string(),
  APP_ENV: Env.schema.enum(['development', 'staging', 'production'] as const),

  /*
  |----------------------------------------------------------
  | Variables for admin alerting emails
  |----------------------------------------------------------
  */
  ALERT_EMAIL_TECH_TEAM: Env.schema.string.optional(),
  ALERT_EMAIL_OPS_TEAM: Env.schema.string.optional(),
  ALERT_EMAIL_FINANCE_TEAM: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for OpenTelemetry export (traces, metrics, logs)
  |----------------------------------------------------------
  | En Docker : http://otel-collector:4318 (résolution DNS du network).
  | En dev local hors Docker : http://localhost:4318.
  */
  OTEL_EXPORTER_OTLP_ENDPOINT: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Provider Hub2 (mobile money) — provider_gateway
  |----------------------------------------------------------
  | Optionnelles au Lot 1 (additif, adapter pas encore branché).
  | À passer en requises au Lot 2 (bascule HTTP→local).
  */
  HUB2_API_ENV: Env.schema.string.optional(),
  HUB2_API_KEY: Env.schema.string.optional(),
  HUB2_API_SECRET: Env.schema.string.optional(),
  HUB2_API_SANDBOX_SECRET: Env.schema.string.optional(),
  HUB2_API_ENDPOINT: Env.schema.string.optional()
})
