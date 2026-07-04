import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  default: env.get('QUEUE_DRIVER', 'redis'),
  adapters: {
    redis: drivers.redis({
      connectionName: 'queue',
    }),
    sync: drivers.sync(),
  },
  worker: {
    concurrency: 5,
    idleDelay: '2s',
  },
  // Découverte des jobs sur les 2 couches physiques (Lot 5 : core + products).
  locations: ['./app/core/**/jobs/**/*.{ts,js}', './app/products/**/jobs/**/*.{ts,js}'],
})
