import router from '@adonisjs/core/services/router'
import { mobileSpec, adminSpec } from '#config/swagger'

// --- Swagger JSON endpoints ---
router.get('/swagger/mobile', async ({ response }) => {
  return response.json(mobileSpec)
})

router.get('/swagger/admin', async ({ response }) => {
  return response.json(adminSpec)
})

// --- Documentation UI routes (Edge views) ---
router.get('/docs/mobile', async ({ view }) => {
  return view.render('docs/swagger-ui', {
    title: 'Aigle Send API — Mobile',
    specUrl: '/swagger/mobile',
  })
})

router.get('/docs/admin', async ({ view }) => {
  return view.render('docs/swagger-ui', {
    title: 'Aigle Send API — Admin',
    specUrl: '/swagger/admin',
  })
})

// --- Index page ---
router.get('/docs', async ({ view }) => {
  return view.render('docs/index')
})
