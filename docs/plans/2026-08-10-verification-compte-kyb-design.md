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
| D3  | **Le moteur de revue reste dans le core** et apprend `ownerType` ; les produits n'exposent que des présentations | Remonter les routes admin au core ; dupliquer la revue pour le KYB | C'est déjà la structure : le lot S2 n'a descendu dans le produit que la présentation, `KycDocumentAdminService` est core. Ni S2 ni R5 n'est contredit | 2026-08-10 |
| D5  | Les colonnes `document_recto_url` / `document_verso_url` / `selfie_url` sont **conservées et cessent d'être écrites** | Drop dans K1 ; double écriture pendant K1 | Convention déjà suivie par le dépôt (`add_account_id_to_kyc_documents`, R4/`users_uid`) : un backfill incomplet sur des documents KYC réels reste rattrapable, sans le coût d'une double représentation | 2026-08-10 |
| D5  | Les colonnes `document_recto_url` / `document_verso_url` / `selfie_url` sont **conservées et cessent d'être écrites** | Drop dans K1 ; double écriture pendant K1 | Convention déjà suivie par le dépôt (`add_account_id_to_kyc_documents`, R4/`users_uid`) : un backfill incomplet sur des documents KYC réels reste rattrapable, sans le coût d'une double représentation | 2026-08-10 |
| D6  | La table des pièces s'appelle **`document_pieces`**, le modèle `DocumentPiece`, l'enum `DocumentPieceType` | `kyc_document_pieces` | Le KYC est **un cas** de la vérification de compte, pas son préfixe : préfixer les pièces par `kyc` graverait dans le schéma la lecture que ce chantier abandonne | 2026-08-10 |
| D7  | **L'onglet KYB du back-office vit dans `products/aiglebusiness`**, pas dans `aiglesend` | Onglet KYB dans le back-office `aiglesend/kyc` | Le back-office des organisations est déjà dans `aiglebusiness/organisation/presentation/admin/`. Chaque produit joint le libellé de son propre propriétaire ; le core n'en résout aucun (résout **U3**) | 2026-08-10 |
| D8  | `KycDocumentAdminService` garde un **shim `findByUser(userId)`** qui délègue à `findByAccountId`, retiré en K3 | Migrer le produit dès K1 ; garder les deux entrées durablement | K1 doit rester invisible : migrer le produit changerait le contrat HTTP du back-office dans le lot censé ne rien changer. L'invariant β (`account_id == usersUid`) rend le shim exact, pas approximatif | 2026-08-10 |
| D4  | **Un dossier de vérification commun** (`kyc_documents` ancré `account_id` + `owner_type`) et **une table de pièces typées** ; les recto/verso/selfie du KYC identité migrent en pièces | Table KYB séparée ; réemploi des colonnes existantes (recto = RCCM) | La prémisse du chantier est que `kyc` *devient* la vérification de compte : une table séparée ferait coexister deux formes de dossier, et le réemploi de colonnes fermerait D2 dès la troisième pièce | 2026-08-10 |

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
| K1  | **Socle « vérification de compte »** — `kyc_documents` devient le dossier ancré `account_id` + `owner_type` ; les pièces passent en table fille typée ; les recto/verso/selfie existants y sont migrés. Le KYC identité fonctionne à l'identique de bout en bout | — | design en cours |
| K2  | **Le dossier KYB dans le core** — types de pièces RCCM/DFE, règle de complétude par segment, soumission par compte org, service de vérification, events | K1 | à faire |
| K3  | **Revue et palier** — la revue admin couvre les dossiers org ; l'approbation pousse le niveau 0 → 2 (`AccountService.setLevel`) et miroite `organisation.level` | K2 | à faire |
| K4  | **Présentations** — soumission owner côté `aiglebusiness` (`kyb:submit` / `kyb:view`), onglet KYB du back-office `aiglesend` | K3 | à faire |

Découpage validé le 2026-08-10 (alternatives écartées : 3 lots avec K1 fondu dans K2 — trop large,
une régression KYC serait dure à isoler ; 5 lots avec K3 scindé en revue puis palier).

---

## Inconnues

| # | Inconnue | Résolution |
| --- | --- | --- |
| U1 | **Volume de `kyc_documents` en production** — la migration D4 (recto/verso/selfie → pièces) parcourt toute la table. Inconnu à ce jour | À mesurer avant d'écrire la migration K1 (`SELECT COUNT(*)`), par l'utilisateur |
| U2 | **`kyc_attemps` n'a pas de `account_id`** — seule `kyc_documents` a reçu la colonne. L'historique des tentatives d'un dossier d'organisation n'a pas de porteur | À trancher dans la section « Architecture » de K1 |
| U3 | **Le back-office lit `user` dans le dossier** (`KycDocumentResult.user`, recherche `whereHas('user')`, stats par CNI/PASSPORT/PERMIS). Pour un dossier d'organisation ces champs sont vides | À trancher dans la section « Impact sur l'existant » de K1 |
| U4 | **La table du dossier s'appelle encore `kyc_documents`** alors que D6 retire `kyc` du vocabulaire des pièces. La renommer touche tous les lots ; ne pas la renommer laisse une incohérence de nommage | À trancher en fin de K1, une fois le rayon d'impact réel connu — hors chemin critique |

---

## Lot K1 — Socle « vérification de compte »

### Architecture — validée le 2026-08-10

Le dossier cesse d'être une pièce d'identité à trois colonnes pour devenir un **dossier de
vérification ancré sur le compte**, dont les pièces vivent dans une table fille typée.

#### Schéma

Les migrations sont lancées par l'utilisateur.

| Table | Changement |
| --- | --- |
| `kyc_documents` | Devient le **dossier**. `account_id` passe NOT NULL (colonne déjà présente et backfillée). `owner_type` ajouté (`user` \| `organisation`), backfill `user`. `document_type` passe nullable. `user_id` conservé |
| `kyc_attemps` | `account_id` ajouté, backfill `= user_id`. La numérotation des tentatives passe **par dossier**, au lieu du couple `(user_id, document_type)` |
| `document_pieces` *(nouvelle)* | `id`, `kyc_document_id` (FK), `piece_type`, `file_url`, `reference` nullable, timestamps. Unique `(kyc_document_id, piece_type)` |

Backfill des pièces : pour chaque dossier existant, une ligne `RECTO`, `VERSO` et `SELFIE` par URL
non vide.

`document_type` **reste sur le dossier** : c'est ce qui rend K1 non-cassant, les stats
`byDocumentType` et les filtres du back-office continuant de lire la même colonne. Il ne vaut que
pour un dossier `user` (CNI / PASSPORT / PERMIS) et est `null` pour un dossier d'organisation. La
pièce, elle, ne porte que son rôle : `RECTO`, `VERSO`, `SELFIE` — puis `RCCM` et `DFE` en K2.

#### Code

- **Domaine** — modèle `DocumentPiece` et enum `DocumentPieceType` ; `KycDocument` gagne
  `accountId`, `ownerType` et `hasMany(pieces)`.
- **Port** — `findUserKycDocument(userId)` devient `findByAccountId(accountId)` ;
  `findLastAttempt` prend le dossier ; ajout de l'écriture des pièces.
- **Application** — `KycDocumentAdminService` et `SubmitKycDocumentUsecase` parlent `accountId` ; la
  soumission écrit des pièces au lieu des trois colonnes. Le contrôleur passe `usersUid` comme
  `accountId` (invariant β : pour un compte utilisateur, `account_id == usersUid`).
- **DTO** — `KycDocumentResult` **gagne** `accountId`, `ownerType` et `pieces[]`, et **garde**
  `userId` et `user` : le back-office existant n'est pas touché.

#### Hors périmètre de K1

Aucun type de pièce KYB, aucune route nouvelle, aucun effet sur les paliers, aucun drop de colonne.

### Impact sur l'existant — validé le 2026-08-10

**Onze fichiers du core, aucun fichier produit.**

| Fichier | Changement |
| --- | --- |
| `domain/models/kyc_document.ts` | `+accountId`, `+ownerType`, `hasMany(pieces)` |
| `domain/models/kyc_attemp.ts` | `+accountId` |
| `domain/models/document_piece.ts` | **nouveau** |
| `domain/enum/kyc_enum.ts` | `+DocumentPieceType` |
| `domain/interfaces/kyc_document_repository.ts` | `findByAccountId`, écriture des pièces |
| `infrastructure/repositories/kyc_document_repository_impl.ts` | requêtes sur `account_id`, `preload('pieces')` |
| `application/services/kyc_document_admin_service.ts` | parle `accountId`, garde le shim `findByUser` (D8) |
| `application/usecases/mobile/submit_kyc_document.usecase.ts` | écrit des pièces au lieu des colonnes |
| `application/dtos/kyc_document_admin.dto.ts` | `+accountId`, `+ownerType`, `+pieces[]` |
| `presentation/mobile/controllers/kyc_submittion_controller.ts` | passe `usersUid` comme `accountId` |
| `database/migrations/…` | les trois migrations du schéma ci-dessus |

**Rétrocompatibilité.** Le `POST` mobile garde son contrat de payload ; les réponses du back-office
gagnent des champs sans en perdre. `ownerType` réutilise l'enum `AccountOwnerType` de
`core/identity/account` — vocabulaire de domaine, importable à travers une frontière (règle 5).

**Risques de régression.**

1. *Backfill de pièces incomplet* — les images deviendraient invisibles au back-office alors que
   D5 conserve la donnée en colonne. Garde-fou : la migration compare le nombre de pièces créées au
   nombre d'URL non vides et échoue si l'écart n'est pas nul.
2. *Renumérotation des tentatives* — la numérotation passe de `(user_id, document_type)` au dossier.
   Un utilisateur ayant soumis deux types de pièce pourrait produire un `attempt_number` en doublon
   dans l'historique. Sans effet fonctionnel, à constater plutôt qu'à corriger.

**Baselines à ne pas dégrader** : `tsc` 57 erreurs, `depcruise` 0 erreur, 584 tests passés / 5 échecs
préexistants (Kyc ×2, ProviderErrorService, DeviceService).

---

## Prochaine session

Étape 4 (design) sur le lot K1, sections restantes : « Flux de données », « Gestion des erreurs »,
« Tests », « Risques & inconnues ».