# Module Authentification Mobile - Énumération des Logiques

## Vue d'ensemble
Ce document énumère toutes les logiques d'authentification identifiées dans le module mobile de l'API Aigle Send v2, basées sur l'analyse du code existant.

## 1. Logiques de Vérification de Numéro de Téléphone

### 1.1 Vérification d'existence utilisateur (`check_phone`)
- **Objectif** : Vérifier si un utilisateur existe avec un numéro de téléphone donné
- **Logique** :
  - Recherche utilisateur par numéro de téléphone
  - Si utilisateur n'existe pas :
    - Marquer `exists = false`
    - Envoyer un OTP pour inscription
  - Si utilisateur existe :
    - Marquer `exists = true`
    - Retourner les informations utilisateur
- **Dépendances** : UserRepository, OtpService
- **Validation** : Numéro de téléphone requis

## 2. Logiques d'Inscription Utilisateur

### 2.1 Enregistrement utilisateur (`registerUser`)
- **Objectif** : Créer un nouvel utilisateur dans le système
- **Logique** :
  - Vérifier que l'utilisateur n'existe pas déjà
  - Valider le code ISO du pays
  - Récupérer les données du pays via CountryRepository
  - Créer l'utilisateur avec country_id
  - Créer automatiquement un wallet pour l'utilisateur
  - Générer un token d'accès
  - Utiliser une transaction base de données pour garantir la cohérence
- **Dépendances** : UserRepository, CountryRepository, WalletRepository, User model
- **Validation** : Données utilisateur complètes, code ISO pays valide
- **Transaction** : Base de données avec rollback en cas d'erreur

## 3. Logiques de Connexion Utilisateur

### 3.1 Processus de login (`loginUser`)
- **Objectif** : Authentifier un utilisateur existant
- **Logique** :
  - Rechercher utilisateur par numéro de téléphone
  - Vérifier le code PIN/mot de passe avec hachage
  - Compter les tentatives de connexion (limite à 4)
  - Envoyer un OTP de vérification après validation du PIN
  - Marquer `access = true` pour indiquer l'autorisation
- **Dépendances** : UserRepository, OtpService, Hash service
- **Validation** : Numéro de téléphone et mot de passe requis
- **Sécurité** : Limitation des tentatives, hachage des mots de passe

### 3.2 Génération de token d'accès (`access_token`)
- **Objectif** : Créer un token d'authentification après vérification OTP
- **Logique** :
  - Rechercher utilisateur par numéro de téléphone
  - Vérifier l'OTP via OtpService
  - Vérifier les tokens existants sur d'autres appareils
  - Créer un nouveau token d'accès
  - Retourner le token à l'utilisateur
- **Dépendances** : UserRepository, OtpService, AuthAccessToken model
- **Validation** : Numéro de téléphone et OTP requis
- **Sécurité** : Gestion des sessions multiples

## 4. Logiques de Vérification OTP

### 4.1 Génération OTP (`sendOtp` - via OtpService)
- **Objectif** : Générer et envoyer un code OTP
- **Logique** :
  - Générer un code OTP aléatoire de 4 chiffres
  - Hacher le code OTP pour stockage sécurisé
  - Définir une expiration (30 secondes dans le code actuel)
  - Stocker l'OTP en base avec user_id, phone, expires_at
  - Envoyer le code via SMS
- **Dépendances** : OtpRepository, SMS service, Hash service
- **Sécurité** : Hachage du code, expiration temporelle

### 4.2 Vérification OTP (`verifyOtp` - via OtpService)
- **Objectif** : Valider un code OTP saisi par l'utilisateur
- **Logique** :
  - Récupérer l'OTP stocké par numéro de téléphone
  - Vérifier l'expiration temporelle
  - Vérifier le verrouillage temporaire (après 3 tentatives échouées)
  - Réinitialiser le compteur si le verrouillage a expiré
  - Incrémenter les tentatives en cas d'échec
  - Verrouiller temporairement après 3 tentatives (1 minute)
  - Comparer le code saisi avec le code haché
- **Dépendances** : OtpRepository, Hash service
- **Sécurité** : Limitation tentatives, verrouillage temporaire, expiration

## 5. Logiques de Gestion de Session

### 5.1 Récupération profil utilisateur (`user_auth`)
- **Objectif** : Récupérer le profil complet de l'utilisateur authentifié
- **Logique** :
  - Charger les données utilisateur avec relations :
    - Wallet (portefeuille)
    - Country (pays)
    - Document (documents KYC)
    - Transactions (2 dernières transactions avec détails paiement)
  - Retourner les données complètes
- **Dépendances** : Relations Eloquent (User, Wallet, Country, Document, Transaction)
- **Performance** : Utilisation du lazy loading avec groupLimit

### 5.2 Déconnexion utilisateur (`logoutUser`)
- **Objectif** : Déconnecter l'utilisateur et invalider le token
- **Logique** :
  - Récupérer l'utilisateur authentifié
  - Récupérer l'identifiant du token actuel
  - Supprimer le token d'accès
  - Confirmer la déconnexion
- **Dépendances** : Auth service, User.accessTokens
- **Sécurité** : Invalidation sécurisée des tokens

## 6. Logiques de Réinitialisation de Mot de Passe

### 6.1 Réinitialisation mot de passe (`reset_password`)
- **Objectif** : Permettre la modification du mot de passe utilisateur
- **Logique** :
  - Mettre à jour le mot de passe via UserRepository
  - Invalider tous les tokens existants sur tous les appareils
  - Créer un nouveau token d'accès
  - Retourner le nouveau token
- **Dépendances** : UserRepository, AuthAccessToken, User.accessTokens
- **Sécurité** : Hachage automatique, invalidation tokens existants

## 7. Logiques de Validation de Code PIN

### 7.1 Vérification code PIN (`check_pin_code`)
- **Objectif** : Valider le code PIN pour opérations sensibles
- **Logique** :
  - Rechercher utilisateur par numéro de téléphone
  - Vérifier le code PIN avec hachage
  - Retourner le statut d'accès
  - Gérer les tentatives incorrectes (limite à 4)
- **Dépendances** : UserRepository, Hash service
- **Sécurité** : Hachage, limitation tentatives
- **Usage** : Pour transactions, modifications sensibles

## 8. Logiques de Validation et Middlewares

### 8.1 Validators d'entrée
- **registerValidator** : Validation des données d'inscription
- **loginValidator** : Validation des données de connexion
- **checkpinValidator** : Validation du code PIN

### 8.2 Middleware d'authentification
- Vérification des tokens d'accès
- Protection des routes sensibles
- Gestion des sessions expirées

## 9. Logiques de Sécurité Transversales

### 9.1 Hachage des mots de passe
- Utilisation du service Hash d'AdonisJS
- Hachage sécurisé des codes PIN
- Vérification avec hash.verify()

### 9.2 Gestion des tokens
- Création via User.accessTokens.create()
- Suppression via User.accessTokens.delete()
- Vérification automatique de validité

### 9.3 Gestion des erreurs
- Formatage uniforme via ResponseFormatter
- Codes d'erreur standardisés (400, 401, 404, 500)
- Messages d'erreur localisés en français

## 10. Logiques de Base de Données

### 10.1 Transactions
- Utilisation de transactions globales pour l'inscription
- Rollback automatique en cas d'erreur
- Garantie de cohérence des données

### 10.2 Relations
- User → Wallet (one-to-one)
- User → Country (many-to-one)
- User → Document (one-to-one)
- User → Transaction (one-to-many)

## 11. Intégrations Externes

### 11.1 Service SMS
- Envoi d'OTP via service externe
- Gestion des erreurs d'envoi
- Support international (via country data)

## 12. Logiques de Validation Métier

### 12.1 Contraintes utilisateur
- Unicité du numéro de téléphone
- Validation du code pays ISO
- Création automatique du wallet

### 12.2 Contraintes de sécurité
- Limitation des tentatives OTP (3 max)
- Verrouillage temporaire (1 minute)
- Expiration OTP (30 secondes)
- Limitation tentatives PIN (4 max)

## Recommandations pour l'Architecture Clean

### Use Cases à créer
- `LoginUseCase` : Logique de connexion
- `RegisterUseCase` : Logique d'inscription
- `VerifyOtpUseCase` : Validation OTP
- `SendOtpUseCase` : Envoi OTP
- `ResetPasswordUseCase` : Réinitialisation mot de passe
- `CheckPinUseCase` : Validation code PIN
- `GetUserProfileUseCase` : Récupération profil
- `LogoutUseCase` : Déconnexion

### Services à créer
- `MobileAuthService` : Logiques métier authentification
- `OtpService` : Gestion OTP (existant, à déplacer)
- `TokenService` : Gestion des tokens
- `ValidationService` : Validation des données

### Repositories partagés
- `UserRepository` : Accès données utilisateur
- `OtpRepository` : Accès données OTP
- `CountryRepository` : Données pays
- `WalletRepository` : Données portefeuille

Cette énumération complète servira de base pour la migration vers la Clean Architecture du module authentification mobile.
