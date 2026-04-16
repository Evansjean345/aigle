import { defineConfig, destinations } from '@adonisjs/otel'
import env from '#start/env'

export default defineConfig({
  serviceName: env.get('APP_NAME'),
  serviceVersion: env.get('APP_VERSION'),
  environment: env.get('APP_ENV'),
  enabled: env.get('NODE_ENV') !== 'test',

  destinations: {
    collector: destinations.otlp({
      endpoint: 'http://localhost:4318',
      signals: 'all',
    }),
  },
})
