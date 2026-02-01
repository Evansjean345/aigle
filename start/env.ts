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
})
