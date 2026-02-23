import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Commands
  |--------------------------------------------------------------------------
  |
  | List of ace commands to register from packages. The application commands
  | will be scanned automatically from the "./commands" directory.
  |
  */
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/cache/commands'),
    () => import('@adonisjs/mail/commands'),
    () => import('@rlanz/bull-queue/commands'),
    () => import('@adonisjs/bouncer/commands'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Service providers
  |--------------------------------------------------------------------------
  |
  | List of service providers to import and register when booting the
  | application
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    // () => import('./providers/app_provider.js'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('@adonisjs/drive/drive_provider'),
    () => import('#providers/repository_provider'),
    {
      file: () => import('@adonisjs/redis/redis_provider'),
      environment: ['web', 'repl', 'console'],
    },
    () => import('#features/notifications/notification_service_provider'),
    () => import('#features/transactions/transaction_provider'),
    () => import('#features/ledger/ledger_provider'),
    {
      file: () => import('@adonisjs/cache/cache_provider'),
      environment: ['web', 'repl', 'console'],
    },
    {
      file: () => import('@adonisjs/limiter/limiter_provider'),
      environment: ['web', 'repl', 'console'],
    },
    () => import('@adonisjs/mail/mail_provider'),
    () => import('@adonisjs/core/providers/edge_provider'),
    {
      file: () => import('@rlanz/bull-queue/queue_provider'),
      environment: ['web', 'repl', 'console'],
    },
    () => import('@adonisjs/bouncer/bouncer_provider'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Preloads
  |--------------------------------------------------------------------------
  |
  | List of modules to import before starting the application.
  |
  */
  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
    () => import('#start/events'),
    () => import('#start/admin_routes'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Tests
  |--------------------------------------------------------------------------
  |
  | List of test suites to organize tests by their type. Feel free to remove
  | and add additional suites.
  |
  */
  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec(.ts|.js)'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec(.ts|.js)'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: false,
  },
  metaFiles: [
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false,
    },
  ],
})
