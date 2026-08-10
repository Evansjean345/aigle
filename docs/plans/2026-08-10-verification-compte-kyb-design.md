---
status: draft
etape: 2
lot: -
derniere_maj: 2026-08-10
---

# Vérification d'entreprise (KYB) — Design

Origine : `docs/plans/2026-08-05-kyb-prompt.md` (prompt de reprise), remarque **R5** de
`docs/plans/remarques-a-brainstormer.md`.

**Mode : large projet** — le chantier touche `core/identity/kyc`, `core/identity/account`, le produit
`aiglebusiness` (soumission owner), le produit `aiglesend` (revue back-office), le schéma
(`kyc_documents`, `kyc_level`) et une grille de paliers à compléter.

---

## Contexte

Relevé du code au 2026-08-10 (les points marqués ✏️ corrigent ou précisent le prompt de reprise).

- **La fondation account-centric est en place.** `accounts.segment` (`particulier` / `marchand` /
  `enterprise`) + `accounts.level` existent (`core/identity/account/domain/models/account.ts`), et
  `AccountStandingService.getStanding(accountId)` résout `(segment, level) → limites` via
  `KycLevelDirectoryService`. Le palier n'est donc pas à inventer, seulement à alimenter.
- **`AccountService.setLevel(accountId, level)` existe déjà** et se documente comme le « push-sync
  depuis la vérification : KYC user / KYB org ». C'est le point d'accroche de l'approbation KYB.
- ✏️ **`kyc_documents.account_id` existe déjà et est backfillé.** Migration
  `1783452576003_add_account_id_to_kyc_documents_table.ts` : colonne uuid nullable indexée, remplie
  par `account_id = user_id`. Le prompt annonçait la migration comme restant à faire — elle est
  livrée côté schéma. Ce qui reste : le **modèle** `KycDocument`, le port
  `KycDocumentRepository` et les use cases qui parlent encore exclusivement `userId`.
- **La grille `kyc_level` est incomplète.** `database/seeders/kyc_level_seeder.ts` pose `marchand` 1,
  `enterprise` 0 (plafonds à 0 = bloqué) et `enterprise` 2 (`null` = illimité). Manquent
  `enterprise` 1, `marchand` 0 et `marchand` 2. Le seeder se déclare lui-même en valeurs
  **placeholder** hors `enterprise` 0 et 2.
- **Provisioning actuel** : `create_organisation.use_case.ts` crée un marchand en `LEVEL_1` et une
  entreprise en `LEVEL_0` ; `organisation_provisioning_service.ts` pose le `segment` du compte.
  ✏️ Le commentaire de `organisation_level.ts` affirme « créée en LEVEL_0 » pour les deux — il est
  périmé pour le marchand.
- **Intention déjà écrite dans les enums** : `organisation_account_type.ts` dit MARCHAND → « KYB par
  photo du lieu → LEVEL_1 après approbation », ENTERPRISE → « KYB par RCCM/DFE → LEVEL_2 ».
  `organisation_level.ts` nomme une source de vérité `organisation_verification` (sous-lot KYB) qui
  **n'existe pas** dans le code.
- ✏️ **Les permissions KYB existent déjà** : `kyb:submit` et `kyb:view` sont dans
  `app/products/aiglebusiness/membership/domain/permissions.config.ts`. Aucune route ne les
  consomme aujourd'hui.
- **La revue admin vit dans le produit** depuis le lot S2 : `products/aiglesend/kyc/.../admin/` —
  mais elle n'est qu'une coquille : `ProcessKycDocumentUseCase` délègue intégralement à
  `KycDocumentAdminService`, qui est **déjà dans le core**. La tension « où vit la revue ? » est donc
  moins profonde qu'annoncée : le moteur est core, seule la présentation est produit.
- **Le KYB n'existe nulle part** dans le code : aucun modèle, table, service ou route.
- **Contraintes** : `docs/rules/2026-08-03-service-boundary-rules.md` (service → repository, retour
  `Result`, jamais de modèle à travers une frontière) ; invariant depcruise
  `core-ne-depend-pas-du-produit` [ERROR] ; le core ne connaît jamais `Organisation`.

### Zones de risque

1. **`kyc_level` est de l'argent.** Compléter la grille change des plafonds réels. Toute ligne
   ajoutée doit être une décision produit explicite, pas un remplissage.
2. **Le double ancrage `user_id` / `account_id`** sur `kyc_documents` pendant la transition : deux
   colonnes, un seul sens. Risque d'écriture divergente si les deux chemins coexistent longtemps.
3. **`KycDocumentType` est un enum de pièces d'identité** (CNI / PASSPORT / PERMIS_CONDUIT).
   L'étendre au RCCM/DFE mélange deux natures de vérification dans une même colonne.
4. **`KycLevelState`** ne connaît que 1 et 2, alors que les comptes vivent déjà au niveau 0.

---

## Décisions

| #   | Décision | Alternatives écartées | Raison | Date |
| --- | -------- | --------------------- | ------ | ---- |
| D0  | Le KYB vit dans le core (`core/identity/kyc` devient « vérification de compte »), documents ancrés `account_id` | KYB dans `products/aiglebusiness` | Acté avec l'utilisateur avant ce design (R5) : le palier du compte dérive de la vérification, un KYB produit créerait `core → produit` | 2026-07-10 |
| D1  | **Seule l'entreprise passe un KYB**, de son niveau 0 (bloqué) au niveau 2 (illimité). Le marchand n'en a pas | Marchand 1 → 2 ; marchand 0 → 1 | Le marchand encaisse dès sa création et le restera ; ajouter une revue bloquante ou un palier marchand supplémentaire n'apporte rien au produit | 2026-08-10 |
| D2  | Le dossier porte des **pièces typées en liste**, seuls RCCM et DFE au départ | Colonnes fixes recto/verso/selfie comme le KYC identité | D'autres pièces sont attendues plus tard ; des colonnes fixes imposeraient une migration à chaque ajout | 2026-08-10 |

### Conséquences de D1

- **La grille `kyc_level` n'a aucune ligne à ajouter.** `enterprise` 0 et 2 existent déjà au seeder.
  `enterprise` niveau 1, annoncé comme manquant dans le prompt de reprise, n'a pas d'emploi ; les
  niveaux `marchand` 0 et 2 non plus.
- Le commentaire de `organisation_account_type.ts` (« MARCHAND : KYB par photo du lieu → LEVEL_1
  après approbation ») est **périmé** et sera corrigé.
- `OrganisationLevel.LEVEL_1` reste le niveau de croisière du marchand ; aucune vérification n'y mène.

---

## Objectif

> On construit la **vérification d'entreprise dans le core** — `core/identity/kyc` devient la
> vérification *de compte* : une entreprise dépose un dossier de pièces typées (RCCM, DFE),
> l'administration le revoit, et l'approbation fait passer son compte du niveau 0 (bloqué) au
> niveau 2 (illimité). C'est réussi si une entreprise fraîchement créée ne peut rien mouvementer,
> dépose son dossier depuis `aiglebusiness`, et devient opérationnelle à l'instant de l'approbation
> en back-office — sans que le core connaisse jamais le modèle `Organisation`.

Validé le 2026-08-10.

---

## Découpage

| Lot | Contenu | Dépend de | Statut |
| --- | ------- | --------- | ------ |
| K1  | **Socle account-anchored** — `kyc_documents` bascule sur `account_id` (colonne déjà présente et backfillée), le port et les services parlent `accountId` + `ownerType`. Zéro changement fonctionnel visible | — | design en cours |
| K2  | **Le dossier KYB dans le core** — pièces typées, soumission par compte org, service de vérification, event | K1 | à faire |
| K3  | **Revue et palier** — la revue admin couvre les dossiers org ; l'approbation pousse le niveau 0 → 2 (`AccountService.setLevel`) et miroite `organisation.level` | K2 | à faire |
| K4  | **Présentations** — soumission owner côté `aiglebusiness` (`kyb:submit` / `kyb:view`), onglet KYB du back-office `aiglesend` | K3 | à faire |

Découpage validé le 2026-08-10 (alternatives écartées : 3 lots avec K1 fondu dans K2 — trop large,
une régression KYC serait dure à isoler ; 5 lots avec K3 scindé en revue puis palier).

---

## Prochaine session

Étape 3 (approches) sur le lot K1 — la question ouverte est l'arbitrage « où vit la revue ? » posé
par le prompt de reprise.