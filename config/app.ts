import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'

/*
|--------------------------------------------------------------------------
| Environnement
|--------------------------------------------------------------------------
*/

export const appEnv = env.get('NODE_ENV', 'development')

/*
|--------------------------------------------------------------------------
| Portails et liens
|--------------------------------------------------------------------------
|
| Bases d'URL des surfaces qui entourent l'API. Servent à construire les liens
| que l'API émet — invitations, redirections d'encaissement, deep links.
|
*/

/** Deep link d'ouverture des applications mobiles. */
export const mobileDeviceDeepLink = env.get('MOBILE_DEVICE_DEEP_LINK_URL')

/** Base du back-office. */
export const adminDashboardUrl: string = env.get('ADMIN_DASHBOARD_URL', 'http://localhost:3000')

/**
 * Base du portail web entreprise (aiglebusiness). Sert notamment à construire le
 * lien d'acceptation d'invitation de membre : `<businessPortalUrl>/accept-invitation?token=`.
 */
export const businessPortalUrl: string = env.get('BUSINESS_PORTAL_URL', 'http://localhost:5000')

/**
 * Base de la page de paiement aigleplay. Le QR marchand encode `<aigleplayPortailUrl>/<code>`.
 */
export const aigleplayPortailUrl: string = env.get('AIGLEPLAY_PORTAIL_URL', 'https://pay.aigle')

/**
 * Page de retour aigleplay après paiement (Orange payment_link / opérateurs à redirection).
 * Le payeur y est renvoyé pour voir le résultat de son encaissement : `<portail>/notify`.
 */
export const aigleplayNotifyUrl: string = `${aigleplayPortailUrl}/notify`

/*
|--------------------------------------------------------------------------
| Revue des magasins d'applications
|--------------------------------------------------------------------------
|
| Ce qui permet aux équipes de revue Google et Apple d'ouvrir un compte sans
| recevoir de SMS. À manier avec précaution : le contournement porte sur
| l'authentification.
|
*/

/** Désactive la vérification OTP. Utilisé par la revue des magasins et en développement. */
export const bypassEnabled: boolean = env.get('BYPASS_OTP_VERIFICATION', false)

/** Numéro réservé à la revue des magasins, exempté d'OTP quand le contournement est actif. */
export const appPhoneNumberReview: string = env.get('APP_REVIEW_PHONE_NUMBER', '0768357397')

/*
|--------------------------------------------------------------------------
| Listes du back-office
|--------------------------------------------------------------------------
|
| Recherche des files de travail.
|
*/

/**
 * Longueur minimale d'un terme de recherche.
 * ex: Ba, Sy, Ka.
 */
export const minSearchLength: number = Number(env.get('LIST_SEARCH_MIN_LENGTH') ?? 2)

/**
 * Nombre d'identifiants au-delà duquel une résolution d'annuaire est journalisée comme incident.
 *
 * Signale sans tronquer : la résolution rend l'ensemble de ses résultats.
 */
export const searchAccountIdsTripwire: number = Number(env.get('LIST_SEARCH_TRIPWIRE') ?? 5000)

/*
|--------------------------------------------------------------------------
| Serveur HTTP
|--------------------------------------------------------------------------
*/

export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,

  trustProxy: () => true,

  /**
   * Enabling async local storage will let you access HTTP context
   * from anywhere inside your application.
   */
  useAsyncLocalStorage: false,

  /**
   * Manage cookies configuration. The settings for the session id cookie are
   * defined inside the "config/session.ExpoPushNotificationChannel" file.
   */
  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
})
