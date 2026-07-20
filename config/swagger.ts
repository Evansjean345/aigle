import path from 'node:path'
import url from 'node:url'
import swaggerJsdoc from 'swagger-jsdoc'

const docsDir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'docs', 'swagger')

const commonDefinition = {
  openapi: '3.0.3',
  servers: [
    {
      url: '{protocol}://{host}',
      variables: {
        protocol: { default: 'http', enum: ['http', 'https'] },
        host: { default: 'localhost:3333' },
      },
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "JWT Bearer token pour l'authentification",
      },
    },
  },
}

// --- Aiglesend (produit consumer) Swagger Spec ---
const aiglesendOptions: swaggerJsdoc.Options = {
  definition: {
    ...commonDefinition,
    info: {
      title: 'Aigle API — Aiglesend',
      version: '1.0.0',
      description:
        "Documentation de l'API du produit consumer Aiglesend — transfert d'argent, wallets, profil, appareils.",
    },
    tags: [
      { name: 'Auth', description: 'Authentification mobile' },
      { name: 'Wallet', description: 'Portefeuilles mobile' },
      { name: 'Opérations', description: 'Opérations financières (dépôt, transfert, etc.)' },
      { name: 'Services', description: 'Services et options de paiement mobile' },
      { name: 'Transactions', description: 'Transactions mobile' },
      { name: 'Profil', description: 'Gestion du profil utilisateur' },
      { name: 'Téléphones de débit', description: 'Gestion des téléphones de débit' },
      { name: 'QR Code', description: 'Gestion des QR codes' },
      { name: 'KYC', description: 'Soumission KYC mobile' },
      { name: 'Appareils', description: 'Gestion des appareils mobile' },
      { name: 'Webhooks', description: 'Callbacks webhooks' },
    ],
  },
  apis: [
    path.join(docsDir, 'auth.yaml'),
    path.join(docsDir, 'wallets.yaml'),
    path.join(docsDir, 'operations.yaml'),
    path.join(docsDir, 'catalogs.yaml'),
    path.join(docsDir, 'transactions.yaml'),
    path.join(docsDir, 'users.yaml'),
    path.join(docsDir, 'qr-kyc-ledger.yaml'),
    path.join(docsDir, 'devices.yaml'),
    path.join(docsDir, 'webhooks.yaml'),
  ],
}

// --- Admin Swagger Spec ---
const adminOptions: swaggerJsdoc.Options = {
  definition: {
    ...commonDefinition,
    info: {
      title: 'Aigle Send API — Admin',
      version: '1.0.0',
      description:
        "Documentation de l'API administrateur Aigle Send — gestion des utilisateurs, transactions, KYC, équipe, etc.",
    },
    tags: [
      { name: 'Admin - Auth', description: 'Authentification admin' },
      { name: 'Admin - Wallets', description: 'Gestion des portefeuilles admin' },
      { name: 'Admin - Contacts', description: 'Gestion des contacts entreprise' },
      { name: 'Admin - Méthodes de paiement', description: 'Gestion des méthodes de paiement' },
      { name: 'Admin - Fournisseurs', description: 'Gestion des fournisseurs' },
      { name: 'Admin - Méthodes fournisseurs', description: 'Gestion des méthodes fournisseurs' },
      { name: 'Admin - Types de service', description: 'Gestion des types de service' },
      { name: 'Admin - Transactions', description: 'Gestion des transactions admin' },
      { name: 'Admin - Utilisateurs', description: 'Gestion des utilisateurs admin' },
      { name: 'Admin - KYC', description: 'Gestion KYC admin' },
      { name: 'Admin - Niveaux KYC', description: 'Gestion des niveaux KYC' },
      { name: 'Admin - Grand livre', description: 'Gestion du grand livre' },
      { name: 'Admin - Appareils', description: 'Gestion des appareils admin' },
      { name: 'Admin - Versions application', description: "Gestion des versions d'application" },
      { name: 'Admin - Équipe', description: "Gestion de l'équipe admin" },
      { name: 'Admin - Rôles', description: 'Gestion des rôles' },
      { name: 'Admin - Permissions', description: 'Gestion des permissions' },
    ],
  },
  apis: [
    path.join(docsDir, 'admin-auth.yaml'),
    path.join(docsDir, 'wallets.yaml'),
    path.join(docsDir, 'catalogs.yaml'),
    path.join(docsDir, 'transactions.yaml'),
    path.join(docsDir, 'users.yaml'),
    path.join(docsDir, 'qr-kyc-ledger.yaml'),
    path.join(docsDir, 'devices.yaml'),
    path.join(docsDir, 'app-versions.yaml'),
    path.join(docsDir, 'team.yaml'),
  ],
}

// --- Aiglebusiness (produit business) Swagger Spec ---
const aiglebusinessOptions: swaggerJsdoc.Options = {
  definition: {
    ...commonDefinition,
    info: {
      title: 'Aigle API — Aiglebusiness',
      version: '1.0.0',
      description:
        "Documentation de l'API du produit business Aiglebusiness — organisations, membres, QR marchand.",
    },
    tags: [
      { name: 'Business - Authentification', description: 'Connexion business (check-phone, login, OTP, sessions)' },
      { name: 'Business - Organisations', description: 'Création et liste des organisations' },
      { name: 'Business - Rôles', description: 'RBAC : rôles et catalogue de permissions' },
      { name: 'Business - Membres', description: 'Gestion des membres d’une organisation' },
      { name: 'Business - Invitations', description: 'Acceptation/refus d’invitation (semi-public)' },
      {
        name: 'Business - Transferts',
        description: 'Décaissement depuis le compte de l’organisation (transfert unique)',
      },
      {
        name: 'Paiement marchand',
        description: 'Encaissement marchand public (page aigleplay) : options, initiation, statut',
      },
      { name: 'QR marchand', description: 'Résolution publique du QR marchand (page de paiement)' },
      { name: 'Business - Santé', description: 'Liveness du module business' },
    ],
  },
  apis: [path.join(docsDir, 'business.yaml')],
}

export const aiglesendSwaggerSpec = swaggerJsdoc(aiglesendOptions)
export const adminSwaggerSpec = swaggerJsdoc(adminOptions)
export const aiglebusinessSwaggerSpec = swaggerJsdoc(aiglebusinessOptions)

// Filter specs to only include paths matching their audience
function filterPaths(spec: any, keepAdmin: boolean): any {
  if (!spec.paths) return spec
  const filtered = { ...spec, paths: {} as Record<string, any> }

  for (const [pathKey, pathValue] of Object.entries(spec.paths)) {
    const methods = pathValue as Record<string, any>
    const hasAdminTag = Object.values(methods).some(
      (op: any) => op.tags && op.tags.some((t: string) => t.startsWith('Admin'))
    )
    if (keepAdmin && hasAdminTag) {
      filtered.paths[pathKey] = pathValue
    } else if (!keepAdmin && !hasAdminTag) {
      filtered.paths[pathKey] = pathValue
    }
  }
  return filtered
}

export const aiglesendSpec = filterPaths(aiglesendSwaggerSpec, false)
export const adminSpec = filterPaths(adminSwaggerSpec, true)
// Le yaml business ne contient que des tags business → pas de filtrage d'audience.
export const aiglebusinessSpec = aiglebusinessSwaggerSpec
