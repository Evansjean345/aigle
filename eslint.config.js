import { configApp } from '@adonisjs/eslint-config'

export default [
  ...configApp(),
  {
    files: ['**/*.ts'],
    ignores: ['app/core/team/domain/value_objects/permission_catalog.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSTypeReference > Identifier[name="PermissionSlug"]',
          message:
            'Un slug de permission ne se forge pas : déclarez-le via definePermissions() dans le catalogue de la feature.',
        },
      ],
    },
  },
]