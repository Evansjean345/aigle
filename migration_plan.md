# Migration Plan: Aigle Send API v2 to Clean Architecture

## Table des Matières
1. [Analyse de l'Architecture Actuelle](#analyse-de-larchitecture-actuelle)
2. [Architecture Cible](#architecture-cible)
3. [Plan de Migration](#plan-de-migration)
4. [Mapping des Composants](#mapping-des-composants)
5. [Étapes Détaillées](#étapes-détaillées)
6. [Recommandations](#recommandations)

## Analyse de l'Architecture Actuelle

### Structure Actuelle
```
app/
├── controllers/
│   └── api/
│       ├── auths_controller.ts
│       ├── operations_controller.ts
│       ├── otps_controller.ts
│       ├── paiements_controller.ts
│       ├── settings_controller.ts
│       ├── telephonies_controller.ts
│       ├── transactions_controller.ts
│       ├── users_controller.ts
│       ├── verify_identities_controller.ts
│       └── webhooks_controller.ts
├── services/
│   ├── airtime_services.ts
│   ├── auth_services.ts
│   ├── gatway_service.ts
│   ├── identity_verify_service.ts
│   ├── operation_service.ts
│   ├── otp_service.ts
│   ├── pass_miss_services.ts
│   ├── payment_service.ts
│   ├── setting_services.ts
│   ├── transaction_service.ts
│   ├── transfert_inter.ts
│   ├── user_service.ts
│   └── webhook_service.ts
├── repositories/
│   ├── country_repository_impl.ts
│   ├── document_repository.ts
│   ├── otp_repository_impl.ts
│   ├── payment_repository.ts
│   ├── setting_repository.ts
│   ├── transaction_repository_impl.ts
│   ├── user_repository_impl.ts
│   └── wallet_repository_impl.ts
├── models/
│   ├── auth_access_token.ts
│   ├── country.ts
│   ├── currencie.ts
│   ├── currency_base.ts
│   ├── demande_virement.ts
│   ├── document.ts
│   ├── mobile_money_detail.ts
│   ├── operator.ts
│   ├── operator_fee.ts
│   ├── otp.ts
│   ├── payment.ts
│   ├── recieiver.ts
│   ├── service.ts
│   ├── service_fee.ts
│   ├── transaction.ts
│   ├── type_payment.ts
│   ├── user.ts
│   └── wallet.ts
└── use_cases/
    ├── transaction/
    │   ├── create_transaction_use_case.ts
    │   ├── delete_transaction_use_case.ts
    │   ├── get_all_transactions_use_case.ts
    │   ├── get_all_transactions_admin_use_case.ts
    │   ├── get_transaction_by_id_use_case.ts
    │   ├── get_transaction_details_use_case.ts
    │   ├── stream_transaction_use_case.ts
    │   ├── update_transaction_status_use_case.ts
    │   └── update_transaction_use_case.ts
    ├── user/
    │   ├── create_user_use_case.ts
    │   ├── delete_user_use_case.ts
    │   ├── get_all_users_use_case.ts
    │   ├── get_user_analytics_use_case.ts
    │   ├── get_user_by_id_use_case.ts
    │   └── update_user_use_case.ts
    └── wallet/
        ├── create_wallet_use_case.ts
        ├── delete_wallet_use_case.ts
        ├── get_all_wallets_use_case.ts
        ├── get_wallet_by_id_use_case.ts
        ├── get_wallet_by_user_id_use_case.ts
        └── update_wallet_use_case.ts
```

### Fonctionnalités Identifiées

#### Fonctionnalités Mobile (Utilisateurs)
- **Authentification** : Login, registration, OTP
- **Transactions** : Création, consultation, détails par utilisateur
- **Portefeuille** : Consultation du solde, recharge
- **Opérations** : Transfert d'argent, dépôt, achat de crédit téléphonique
- **Vérification d'identité** : Vérification KYC
- **Services** : Services financiers disponibles

#### Fonctionnalités Admin
- **Authentification Admin** : Login administrateur
- **Gestion des Transactions** : Consultation de toutes les transactions, mise à jour du statut, analytics
- **Gestion des Utilisateurs** : Consultation de tous les utilisateurs, analytics, gestion du statut
- **Analytics** : Statistiques du dashboard, génération de rapports
- **Paramètres** : Gestion des opérateurs, services, frais

#### Composants Partagés
- **Repositories** : Accès aux données (transaction, user, wallet, payment, otp, etc.)
- **Models** : Entités métier (transaction, user, wallet, etc.)
- **Services** : Services de notification, validation, calcul des frais
- **Interfaces** : Contrats métier

## Architecture Cible

```
app/
├── features/
│   ├── mobile/
│   │   ├── authentication/
│   │   │   ├── controllers/auth_controller.ts
│   │   │   ├── services/mobile_auth_service.ts
│   │   │   ├── use_cases/
│   │   │   │   ├── login_use_case.ts
│   │   │   │   └── register_use_case.ts
│   │   │   ├── middleware/mobile_auth_middleware.ts
│   │   │   └── routes/auth_routes.ts
│   │   ├── transactions/
│   │   │   ├── controllers/mobile_transaction_controller.ts
│   │   │   ├── services/mobile_transaction_service.ts
│   │   │   ├── use_cases/
│   │   │   │   ├── create_transaction_use_case.ts
│   │   │   │   ├── get_user_transactions_use_case.ts
│   │   │   │   └── get_transaction_details_use_case.ts
│   │   │   └── routes/transaction_routes.ts
│   │   ├── wallet/
│   │   │   ├── controllers/wallet_controller.ts
│   │   │   ├── services/wallet_service.ts
│   │   │   ├── use_cases/
│   │   │   │   ├── get_balance_use_case.ts
│   │   │   │   └── topup_wallet_use_case.ts
│   │   │   └── routes/wallet_routes.ts
│   │   └── operations/
│   │       ├── controllers/operations_controller.ts
│   │       ├── services/operations_service.ts
│   │       ├── use_cases/
│   │       │   ├── transfer_money_use_case.ts
│   │       │   ├── deposit_money_use_case.ts
│   │       │   └── buy_airtime_use_case.ts
│   │       └── routes/operations_routes.ts
│   └── admin/
│       ├── authentication/
│       │   ├── controllers/admin_auth_controller.ts
│       │   ├── services/admin_auth_service.ts
│       │   ├── use_cases/admin_login_use_case.ts
│       │   ├── middleware/admin_auth_middleware.ts
│       │   └── routes/auth_routes.ts
│       ├── transactions/
│       │   ├── controllers/admin_transaction_controller.ts
│       │   ├── services/admin_transaction_service.ts
│       │   ├── use_cases/
│       │   │   ├── get_all_transactions_use_case.ts
│       │   │   ├── update_transaction_status_use_case.ts
│       │   │   └── get_transaction_analytics_use_case.ts
│       │   └── routes/transaction_routes.ts
│       ├── users/
│       │   ├── controllers/user_management_controller.ts
│       │   ├── services/user_management_service.ts
│       │   ├── use_cases/
│       │   │   ├── get_all_users_use_case.ts
│       │   │   ├── update_user_status_use_case.ts
│       │   │   └── get_user_details_use_case.ts
│       │   └── routes/user_routes.ts
│       └── analytics/
│           ├── controllers/analytics_controller.ts
│           ├── services/analytics_service.ts
│           ├── use_cases/
│           │   ├── get_dashboard_stats_use_case.ts
│           │   └── generate_report_use_case.ts
│           └── routes/analytics_routes.ts
├── shared/
│   ├── repositories/
│   │   ├── transaction_repository_impl.ts
│   │   ├── user_repository_impl.ts
│   │   └── wallet_repository_impl.ts
│   ├── services/
│   │   ├── notification_service.ts
│   │   ├── validation_service.ts
│   │   └── fee_calculation_service.ts
│   ├── models/
│   │   ├── transaction.ts
│   │   ├── user.ts
│   │   └── wallet.ts
│   └── interfaces/
│       ├── transaction.repository.ts
│       └── user_interface.ts
└── start/
    └── routes.ts
```

## Plan de Migration

### Phase 1: Préparation et Structure (Semaine 1-2)
1. **Créer la nouvelle structure de dossiers**
   - Créer `app/features/mobile/` et `app/features/admin/`
   - Créer `app/shared/`
   - Maintenir l'ancienne structure temporairement

2. **Identifier et préparer les composants partagés**
   - Déplacer les models vers `shared/models/`
   - Déplacer les repositories vers `shared/repositories/`
   - Créer les interfaces métier dans `shared/interfaces/`

### Phase 2: Migration des Fonctionnalités Mobile (Semaine 3-4)
1. **Authentication Mobile**
   - Extraire la logique d'authentification mobile
   - Créer les use cases de login et register
   - Implémenter le middleware mobile

2. **Transactions Mobile**
   - Migrer les use cases de transaction utilisateur
   - Créer le contrôleur mobile dédié
   - Adapter le service de transaction

3. **Wallet Mobile**
   - Extraire les fonctionnalités de portefeuille
   - Créer les use cases de consultation et recharge

4. **Operations Mobile**
   - Migrer les services d'opérations
   - Créer les use cases de transfert, dépôt, airtime

### Phase 3: Migration des Fonctionnalités Admin (Semaine 5-6)
1. **Authentication Admin**
   - Séparer l'authentification admin
   - Créer le middleware admin dédié

2. **Admin Transactions**
   - Migrer les use cases admin
   - Créer les analytics de transactions

3. **User Management**
   - Créer le module de gestion utilisateurs
   - Implémenter les analytics utilisateurs

4. **Analytics Admin**
   - Créer le dashboard d'analytics
   - Implémenter la génération de rapports

### Phase 4: Routes et Finalisation (Semaine 7)
1. **Restructurer les routes**
   - Séparer les routes mobile et admin
   - Créer des fichiers de routes modulaires

2. **Tests et validation**
   - Tester toutes les fonctionnalités
   - Valider la séparation des domaines

3. **Nettoyage**
   - Supprimer l'ancienne structure
   - Mettre à jour les imports

## Mapping des Composants

### Mobile Authentication
- **Actuel**: `auths_controller.ts`, `auth_services.ts`, `otp_service.ts`
- **Cible**: `mobile/authentication/`

### Mobile Transactions
- **Actuel**: `transactions_controller.ts` (partie utilisateur), `transaction_service.ts`
- **Cible**: `mobile/transactions/`

### Mobile Wallet
- **Actuel**: Use cases wallet, services wallet
- **Cible**: `mobile/wallet/`

### Mobile Operations
- **Actuel**: `operations_controller.ts`, `operation_service.ts`, `airtime_services.ts`
- **Cible**: `mobile/operations/`

### Admin Authentication
- **Actuel**: `auths_controller.ts` (partie admin)
- **Cible**: `admin/authentication/`

### Admin Transactions
- **Actuel**: `transactions_controller.ts` (partie admin), analytics transactions
- **Cible**: `admin/transactions/`

### Admin Users
- **Actuel**: `users_controller.ts`, `user_service.ts`
- **Cible**: `admin/users/`

### Admin Analytics
- **Actuel**: Analytics dispersées dans plusieurs contrôleurs
- **Cible**: `admin/analytics/`

### Shared Components
- **Models**: Tous les models actuels
- **Repositories**: Tous les repositories actuels
- **Services**: Services de notification, validation, frais

## Étapes Détaillées

### Étape 1: Création de la Structure
```bash
# Créer les dossiers principaux
mkdir -p app/features/mobile/authentication/{controllers,services,use_cases,middleware,routes}
mkdir -p app/features/mobile/transactions/{controllers,services,use_cases,routes}
mkdir -p app/features/mobile/wallet/{controllers,services,use_cases,routes}
mkdir -p app/features/mobile/operations/{controllers,services,use_cases,routes}

mkdir -p app/features/admin/authentication/{controllers,services,use_cases,middleware,routes}
mkdir -p app/features/admin/transactions/{controllers,services,use_cases,routes}
mkdir -p app/features/admin/users/{controllers,services,use_cases,routes}
mkdir -p app/features/admin/analytics/{controllers,services,use_cases,routes}

mkdir -p app/shared/{repositories,services,models,interfaces}
```

### Étape 2: Migration des Models et Repositories
```bash
# Déplacer les models vers shared
mv app/models/* app/shared/models/

# Déplacer les repositories vers shared
mv app/repositories/* app/shared/repositories/
```

### Étape 3: Création des Use Cases Mobile

#### Mobile Authentication Use Cases
- `login_use_case.ts`: Logique de connexion mobile
- `register_use_case.ts`: Logique d'inscription
- `verify_otp_use_case.ts`: Vérification OTP

#### Mobile Transaction Use Cases
- `create_transaction_use_case.ts`: Création de transaction
- `get_user_transactions_use_case.ts`: Récupération transactions utilisateur
- `get_transaction_details_use_case.ts`: Détails d'une transaction

#### Mobile Wallet Use Cases
- `get_balance_use_case.ts`: Consultation du solde
- `topup_wallet_use_case.ts`: Recharge du portefeuille

#### Mobile Operations Use Cases
- `transfer_money_use_case.ts`: Transfert d'argent
- `deposit_money_use_case.ts`: Dépôt d'argent
- `buy_airtime_use_case.ts`: Achat de crédit

### Étape 4: Création des Use Cases Admin

#### Admin Transaction Use Cases
- `get_all_transactions_use_case.ts`: Toutes les transactions
- `update_transaction_status_use_case.ts`: Mise à jour statut
- `get_transaction_analytics_use_case.ts`: Analytics transactions

#### Admin User Management Use Cases
- `get_all_users_use_case.ts`: Tous les utilisateurs
- `update_user_status_use_case.ts`: Mise à jour statut utilisateur
- `get_user_details_use_case.ts`: Détails utilisateur

#### Admin Analytics Use Cases
- `get_dashboard_stats_use_case.ts`: Statistiques dashboard
- `generate_report_use_case.ts`: Génération de rapports

### Étape 5: Migration des Controllers et Services

#### Migration Progressive
1. **Dupliquer** les controllers existants dans les nouvelles structures
2. **Adapter** chaque controller à son domaine spécifique
3. **Supprimer** les fonctionnalités non pertinentes
4. **Mettre à jour** les imports et dépendances

### Étape 6: Restructuration des Routes

#### Routes Mobile (`start/mobile_routes.ts`)
```typescript
// Routes d'authentification mobile
router.group(() => {
  router.post('login', [MobileAuthController, 'login'])
  router.post('register', [MobileAuthController, 'register'])
}).prefix('mobile/auth')

// Routes de transactions mobile
router.group(() => {
  router.post('create', [MobileTransactionController, 'create'])
  router.get('user/:userId', [MobileTransactionController, 'getUserTransactions'])
}).prefix('mobile/transactions').use(middleware.auth())
```

#### Routes Admin (`start/admin_routes.ts`)
```typescript
// Routes d'authentification admin
router.group(() => {
  router.post('login', [AdminAuthController, 'login'])
}).prefix('admin/auth')

// Routes de gestion des transactions admin
router.group(() => {
  router.get('all', [AdminTransactionController, 'getAllTransactions'])
  router.patch('status/:id', [AdminTransactionController, 'updateStatus'])
}).prefix('admin/transactions').use(middleware.adminAuth())
```

## Recommandations

### 1. Approche de Migration
- **Migration Progressive**: Ne pas tout migrer d'un coup
- **Tests Continus**: Tester chaque composant migré
- **Rollback Plan**: Garder l'ancienne structure jusqu'à validation complète

### 2. Bonnes Pratiques
- **Dependency Injection**: Maintenir l'injection de dépendances AdonisJS
- **Interface Contracts**: Utiliser des interfaces pour les contrats métier
- **Error Handling**: Standardiser la gestion d'erreurs par domaine

### 3. Points d'Attention
- **Middleware**: Séparer clairement les middlewares mobile et admin
- **Permissions**: Revoir les permissions par domaine
- **API Versioning**: Considérer le versioning des APIs

### 4. Tests
- **Unit Tests**: Tester chaque use case individuellement
- **Integration Tests**: Tester les interactions entre domaines
- **E2E Tests**: Tester les parcours utilisateur complets

### 5. Documentation
- **API Documentation**: Mettre à jour la documentation API
- **Architecture Decision Records**: Documenter les décisions architecturales
- **Migration Guide**: Créer un guide de migration pour l'équipe

## Conclusion

Cette migration vers une Clean Architecture avec séparation des domaines mobile et admin permettra:

1. **Meilleure maintenabilité** du code
2. **Séparation claire** des responsabilités
3. **Facilité de test** et de débogage
4. **Évolutivité** de l'application
5. **Onboarding** plus facile pour de nouveaux développeurs

Le plan proposé s'étale sur 7 semaines avec une approche progressive pour minimiser les risques et maintenir la continuité du service.
