import { defineConfig } from '@adonisjs/cors'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: '*',
  // `PATCH` a été ajouté avec les premières routes PATCH du projet (catalogue des comptes de
  // collecte, F1). Sans lui, le préflight échoue et le navigateur bloque la requête — le GET passait
  // pendant que la modification et la désactivation étaient silencieusement impossibles.
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
