import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import type { Config } from '@japa/runner/types'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * This file is imported by the "bin/test.ExpoPushNotificationChannel" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
// N.B.: On évite de booter l'application AdonisJS pour les tests unitaires afin
// d'éliminer les dépendances externes (ex: Redis) pendant l'exécution des tests.
export const plugins: Config['plugins'] = [assert(), apiClient()]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (suite.name === 'unit') {
    // Les tests unitaires n'ont pas besoin du serveur HTTP ni de l'app bootée
    return
  }

  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
