import router from '@adonisjs/core/services/router'
import { aiglesendSpec, adminSpec, aiglebusinessSpec } from '#config/swagger'

// --- Swagger JSON endpoints ---
router.get('/swagger/aiglesend', async ({ response }) => {
  return response.json(aiglesendSpec)
})

router.get('/swagger/admin', async ({ response }) => {
  return response.json(adminSpec)
})

router.get('/swagger/aiglebusiness', async ({ response }) => {
  return response.json(aiglebusinessSpec)
})

// --- Documentation UI routes (Edge views) ---
router.get('/docs/aiglesend', async ({ view }) => {
  return view.render('docs/api-reference', {
    title: 'Aigle API — Aiglesend',
    specUrl: '/swagger/aiglesend',
  })
})

router.get('/docs/admin', async ({ view }) => {
  return view.render('docs/api-reference', {
    title: 'Aigle API — Admin',
    specUrl: '/swagger/admin',
  })
})

router.get('/docs/aiglebusiness', async ({ view }) => {
  return view.render('docs/api-reference', {
    title: 'Aigle API — Aiglebusiness',
    specUrl: '/swagger/aiglebusiness',
  })
})

// --- Index page ---
router.get('/docs', async ({ view }) => {
  return view.render('docs/index')
})