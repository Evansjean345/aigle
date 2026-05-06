import { defineConfig, destinations } from '@adonisjs/otel'
import env from '#start/env'

export default defineConfig({
  serviceName: env.get('APP_NAME'),
  serviceVersion: env.get('APP_VERSION'),
  environment: env.get('APP_ENV'),
  enabled: env.get('NODE_ENV') !== 'test',

  destinations: {
    collector: destinations.otlp({
      endpoint: env.get('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://otel-collector:4318'),
      signals: 'all',
    }),
  },
})
