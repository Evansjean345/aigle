/**
 * Runner Japa standalone pour les tests unitaires purs.
 * N'initialise PAS le framework AdonisJS (pas de Redis, DB, etc.).
 *
 * Usage: npx tsx bin/test_unit.ts
 */
import 'reflect-metadata'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))

configure({
  files: ['tests/unit/**/*.spec.ts'],
  plugins: [assert()],
})

run()