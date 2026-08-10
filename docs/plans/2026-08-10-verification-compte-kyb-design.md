---
status: approved
etape: 6
lot: K1 (implémentation)
derniere_maj: 2026-08-10
---

# Vérification d'entreprise (KYB) — Design

Origine : `docs/plans/2026-08-05-kyb-prompt.md` (prompt de reprise), remarque **R5** de
`docs/plans/remarques-a-brainstormer.md`.

**Mode : large projet** — le chantier touche `core/identity/kyc`, `core/identity/account`, le produit
`aiglebusiness` (soumission owner **et** revue back-office, cf. D7) et le schéma (`kyc_documents`,
`kyc_attemps`, nouvelle table `document_pieces`).

La grille `kyc_level`, elle, n'est **pas** touchée : D1 l'a rendue inutile à compléter.

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
| D4  | **Un dossier de vérification commun** (`kyc_documents` ancré `account_id` + `owner_type`) et **une table de pièces typées**. **L'historique KYC n'est pas migré** : les dossiers antérieurs gardent leurs trois colonnes, lues en repli | Table KYB dédiée ; réemploi des colonnes existantes (recto = RCCM) ; dossier commun **avec** migration de l'historique | Réexaminée le 2026-08-10 à la demande de l'utilisateur. Une table dédiée dupliquerait `status` / `comment` / `agent_id` / `valid_until` **et** la table des tentatives, et priverait le back-office d'une file d'attente unique. Ne pas migrer l'historique supprime le risque numéro un du chantier (réécrire des dossiers KYC de production) pour le prix d'un repli de lecture, qui meurt de lui-même à mesure que les vieux dossiers sont resoumis | 2026-08-10 |
| D5  | Les colonnes `document_recto_url` / `document_verso_url` / `selfie_url` sont **conservées et lues en repli** quand le dossier n'a pas de pièces ; elles cessent d'être écrites | Drop dans K1 ; double écriture pendant K1 | Corollaire de D4 : elles restent la source de vérité des dossiers antérieurs à K1. Convention déjà suivie par le dépôt (`add_account_id_to_kyc_documents`, R4/`users_uid`) | 2026-08-10 |
| D6  | La table des pièces s'appelle **`document_pieces`**, le modèle `DocumentPiece`, l'enum `DocumentPieceType` | `kyc_document_pieces` | Le KYC est **un cas** de la vérification de compte, pas son préfixe : préfixer les pièces par `kyc` graverait dans le schéma la lecture que ce chantier abandonne | 2026-08-10 |
| D7  | **L'onglet KYB du back-office vit dans `products/aiglebusiness`**, pas dans `aiglesend` | Onglet KYB dans le back-office `aiglesend/kyc` | Le back-office des organisations est déjà dans `aiglebusiness/organisation/presentation/admin/`. Chaque produit joint le libellé de son propre propriétaire ; le core n'en résout aucun (résout **U3**) | 2026-08-10 |
| D8  | `KycDocumentAdminService` garde un **shim `findByUser(userId)`** qui délègue à `findByAccountId`, retiré en K3 | Migrer le produit dès K1 ; garder les deux entrées durablement | K1 doit rester invisible : migrer le produit changerait le contrat HTTP du back-office dans le lot censé ne rien changer. L'invariant β (`account_id == usersUid`) rend le shim exact, pas approximatif | 2026-08-10 |
| D9  | La règle de complétude d'un dossier vit dans un **catalogue en code**, dans `core/identity/kyc/domain` | Table de configuration en base ; règle portée par le validator HTTP de chaque produit | Deux entrées aujourd'hui : une table coûterait repository, cache et écran d'administration pour rien. La porter côté produit sortirait du core une règle qui détermine une montée de palier | 2026-08-10 |
| D10 | `SubmitKycDocumentUsecase` **délègue** à `AccountVerificationService` — un seul moteur de soumission pour KYC et KYB | Deux chemins distincts ; unification différée à un lot dédié | C'est le patron déjà en place côté revue (`ProcessKycDocumentUseCase` → `KycDocumentAdminService`). Deux orchestrations sur le même stockage laisseraient la règle de complétude diverger | 2026-08-10 |
| D11 | `valid_until` reste **porté par le dossier**, pas par la pièce | Validité par pièce | Le renouvellement d'un RCCM ou d'un DFE entraîne une resoumission du dossier entier ; une validité par pièce n'aurait pas de consommateur | 2026-08-10 |
| D12 | La **référence** (numéro RCCM / DFE) est **obligatoire à la soumission**, non vide, **sans contrainte de format** | Fichier seul ; saisie par le gestionnaire à la revue ; validation par regex du format OHADA | Le numéro est la clé de requête vers un registre officiel : sans champ structuré, aucune vérification automatique n'est possible plus tard. Le déclarer à la soumission préserve l'écart déclaré/lu comme signal de fraude, que la saisie par le gestionnaire supprimerait. Pas de regex : un format OHADA mal deviné rejetterait des entreprises légitimes sans recours | 2026-08-10 |
| D13 | **Soumission progressive pour l'entreprise.** Le dossier est une machine à états portée par `kyc_documents.status` : `in_submission` tant qu'une pièce requise manque, `pending` dès que la dernière arrive. `next_action` nomme la pièce attendue. Le catalogue (D9) porte, par segment, les pièces requises **et le mode** — `particulier` atomique, `enterprise` progressif | Refuser toute soumission incomplète ; envoi explicite en revue par le propriétaire ; fenêtre de correction après complétude | Une entreprise n'a pas toujours son DFE le jour où elle a son RCCM. `IN_SUBMISSION` et `KycDocumentNextAction` sont **déjà déclarés et inutilisés** dans `kyc_enum.ts` — l'échafaudage attendait ce cas. Le passage automatique évite qu'un dossier complet dorme parce que personne n'a cliqué. Le mode atomique préserve à l'identique le chemin KYC identité | 2026-08-10 |
| D15 | L'approbation d'un dossier d'organisation monte le compte via un **listener core dédié**, `SyncAccountLevelOnVerificationProcessed`, symétrique de celui du KYC | Poussée synchrone depuis le service de revue ; généraliser `OnUserKycStatusUpdate` | La chaîne KYC existante transite par le modèle `User`, qu'une organisation n'a pas. Un listener jumeau garde une seule mécanique — l'event — pour les deux cas, sans faire traiter des comptes sans utilisateur par un listener d'`identity/user` | 2026-08-10 |
| D16 | Le garde-fou contre « dossier approuvé, compte resté au niveau 0 » est **l'écart rendu visible au back-office** : statut du dossier et niveau du compte affichés côte à côte, échecs du listener journalisés | Vérification après coup par le service ; montée synchrone | La vérification après coup redonnerait au service la connaissance de l'effet de son event, que D15 découple, et peut courir avant le listener. La montée synchrone reviendrait à l'approche écartée en D15 | 2026-08-10 |
| D17 | La revue KYB reçoit son **groupe de droits back-office dédié**, `organisations.kyb.*` (`read` / `approve` / `reject`), et non les droits `kyc_documents.*` existants | Réutiliser `kyc_documents.*` ; ne séparer que la consultation | Approuver un KYB fait passer une entreprise de « bloquée » à « plafonds illimités ». Réutiliser `kyc_documents.approve` donnerait ce pouvoir à tout agent habilité à valider une carte d'identité. La séparation `read` / `approve` / `reject` reprend la forme et la raison déjà écrites dans `KYC_PERMISSIONS` | 2026-08-10 |
| D14 | **Le refus porte sur le dossier**, pas sur la pièce ; le motif nomme la pièce en cause | Statut par pièce ; refus global avec liste de pièces à reprendre | La soumission progressive (D13) donne déjà le résultat pratique : l'entreprise redépose le seul DFE, le RCCM en place ne bouge pas. Un statut par pièce obligerait l'historique des tentatives à suivre le grain de la pièce | 2026-08-10 |

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
| K1  | **Socle « vérification de compte »** — `kyc_documents` devient le dossier ancré `account_id` + `owner_type` ; les pièces passent en table fille typée ; les recto/verso/selfie existants y sont migrés. Le KYC identité fonctionne à l'identique de bout en bout | — | **design terminé** |
| K2  | **Le dossier KYB dans le core** — types de pièces RCCM/DFE, règle de complétude par segment, soumission par compte org, service de vérification, events | K1 | **design terminé** |
| K3  | **Revue et palier** — la revue admin couvre les dossiers org ; l'approbation pousse le niveau 0 → 2 (`AccountService.setLevel`) et miroite `organisation.level` | K2 | **design terminé** |
| K4  | **Présentations** — soumission owner côté `aiglebusiness` (`kyb:submit` / `kyb:view`), onglet KYB du back-office `aiglesend` | K3 | **design terminé** |

Découpage validé le 2026-08-10 (alternatives écartées : 3 lots avec K1 fondu dans K2 — trop large,
une régression KYC serait dure à isoler ; 5 lots avec K3 scindé en revue puis palier).

---

## Inconnues

| # | Inconnue | Résolution |
| --- | --- | --- |
| ~~U1~~ | ~~Volume de `kyc_documents` en production~~ | **Close le 2026-08-10** — D4 renonce au backfill, le volume n'a plus d'effet |
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

**Aucun backfill de pièces** (D4) : les dossiers antérieurs à K1 restent tels quels et sont lus sur
leurs trois colonnes. Seules les soumissions postérieures écrivent des pièces. La lecture applique
donc un repli — un dossier sans pièce projette ses colonnes en pièces à la volée — et ce repli
disparaît de lui-même à mesure que les vieux dossiers sont resoumis.

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

1. *Repli de lecture oublié* — un chemin de lecture qui n'applique pas le repli D4 afficherait un
   dossier antérieur à K1 sans aucune image. Garde-fou : le repli vit dans la projection
   `toKycDocumentResult`, en un seul endroit, et non chez chaque appelant.
2. *Renumérotation des tentatives* — la numérotation passe de `(user_id, document_type)` au dossier.
   Un utilisateur ayant soumis deux types de pièce pourrait produire un `attempt_number` en doublon
   dans l'historique. Sans effet fonctionnel, à constater plutôt qu'à corriger.

**Baselines à ne pas dégrader** : `tsc` 57 erreurs, `depcruise` 0 erreur, 584 tests passés / 5 échecs
préexistants (Kyc ×2, ProviderErrorService, DeviceService).

### Flux de données — validé le 2026-08-10

Le chemin du KYC identité est fonctionnellement identique.

1. `POST /kyc` — le contrôleur valide le payload et passe `usersUid` comme `accountId`.
2. `SubmitKycDocumentUsecase` charge le dossier par `findByAccountId` et refuse une soumission si le
   dossier est `APPROVED` ou `PENDING`.
3. Upload des fichiers vers `FileStorageService` — les chemins de stockage restent identiques *en
   valeur*, puisque `accountId == usersUid`.
4. Le dossier est écrit avec `ownerType = user`, puis les pièces en `upsert` sur
   `(kyc_document_id, piece_type)`.
5. La tentative est numérotée par dossier.
6. L'audit et l'event `KycDocumentSubmitted` sont inchangés et portent toujours `userId`.

En lecture back-office, `findAll` et `findById` préchargent les pièces en plus de l'agent, du
porteur et des tentatives ; `toKycDocumentResult` les projette dans `pieces[]`.

### Gestion des erreurs — validée le 2026-08-10

Les trois exceptions existantes gardent leur sémantique : `KycDocumentNotFoundException`,
`KycAlreadySubmittedException`, `MissingKycDocumentsException` — règle passeport comprise (pas de
verso attendu).

Un seul cas nouveau : une écriture de pièce qui échoue ne doit pas laisser un dossier `PENDING` sans
pièces. L'atomicité revient au **repository qui écrit** dossier et pièces, conformément à
`transaction-portee-par-le-service` — ni au use case, ni à la présentation.

Le fichier orphelin dans le stockage en cas d'échec base après upload existe déjà aujourd'hui ; K1
ne l'aggrave pas et ne le traite pas.

### Tests — validés le 2026-08-10

**À adapter** : `tests/unit/kyc/submit_kyc_document.spec.ts`,
`tests/unit/kyc/process_kyc_document.spec.ts`, `tests/functional/kyc/`.

**Nouveaux** :

- la soumission crée N pièces typées et n'écrit plus les trois colonnes ;
- une resoumission remplace les pièces sans les dupliquer (unicité `(dossier, piece_type)`) ;
- un passeport produit `RECTO` + `SELFIE`, sans `VERSO` ;
- `findByAccountId` retrouve le dossier d'un compte utilisateur par l'invariant β ;
- le `Result` expose `pieces[]`, `accountId` et `ownerType` tout en gardant `user` ;
- **un dossier antérieur à K1, sans aucune pièce, projette bien ses trois colonnes** (repli D4) ;
- un échec d'écriture de pièce ne laisse aucun dossier orphelin.

Les 2 échecs KYC préexistants sont **hors périmètre** : K1 ne prétend pas les corriger.

### Risques & repli — validés le 2026-08-10

- **U1 est close** : D4 ayant renoncé au backfill, le volume de `kyc_documents` n'a plus d'effet sur
  le chantier.
- **U4** (nom de la table `kyc_documents`) se tranche en fin de K1.
- **Repli** : aucune donnée existante n'est réécrite. Un retour arrière sur K1 se limite à cesser
  d'écrire des pièces — les dossiers antérieurs n'ont jamais bougé.

**Design de K1 complet.**

---

## Lot K2 — Le dossier KYB dans le core

### Architecture — validée le 2026-08-10

Le dossier KYB ne crée aucune structure : c'est un dossier du socle K1 avec
`ownerType = organisation`, `documentType = null`, et des pièces `RCCM` et `DFE` portant chacune son
`fileUrl` et sa `reference` — le numéro d'immatriculation.

#### Domaine

- `DocumentPieceType` gagne `RCCM` et `DFE`.
- Un **catalogue de complétude** `requiredPieces(segment, documentType?)` : `enterprise` exige
  `RCCM` + `DFE` ; `particulier` exige `RECTO` + `SELFIE`, plus `VERSO` hors passeport. Le catalogue
  porte aussi le **mode** de soumission : `particulier` atomique, `enterprise` progressif (D13).
- Exception `IncompleteVerificationFileException` — levée en mode **atomique** seulement.

#### La machine à états du dossier (D13)

```
                pièce reçue, il en manque             dernière pièce reçue
   (aucun)  ────────────────────────────►  in_submission  ──────────────►  pending
                                            next_action =                  next_action =
                                            pièce attendue                 IN_REVIEW
```

Un dossier `in_submission` **n'atteint jamais un gestionnaire** : la file de revue ne lit que
`pending`. Le statut vit sur le dossier ; une pièce n'a pas d'état propre, elle est présente ou
absente.

En mode atomique (`particulier`), les pièces arrivent ensemble et le dossier passe directement en
`pending` — le chemin KYC identité est inchangé.

#### Application

`AccountVerificationService.submit({ accountId, pieces })` porte la soumission pour **n'importe quel
compte**, avec une liste de pièces qui peut être partielle :

1. lit `ownerType` et `segment` du compte via le service `account` — `identity/kyc` consommant
   `identity/account`, franchissement intra-contexte, autorisé ;
2. en mode atomique, refuse si le lot reçu ne couvre pas les pièces requises ;
3. téléverse les fichiers, écrit dossier et pièces dans une transaction portée par le repository ;
4. recalcule les pièces manquantes via le catalogue et pose `status` et `next_action` en
   conséquence (D13) ;
5. émet l'event ;
6. rend un `Result` — statut, `nextAction` et pièces manquantes, jamais le modèle.

La même méthode sert les deux chemins : le mobile envoie ses trois pièces d'un coup, une entreprise
en envoie une seule.

`SubmitKycDocumentUsecase` est réduit à un appel à ce service (D10).

#### Events

`KycDocumentSubmitted` gagne `accountId` et `ownerType` ; `userId` devient nullable pour un dossier
d'organisation. Les deux listeners de diffusion admin doivent tolérer cette absence.

#### Hors périmètre de K2

Aucune route, aucune présentation, aucun effet sur les paliers — la revue et la montée de niveau
sont K3, les présentations K4.

### Impact sur l'existant — validé le 2026-08-10

**Neuf fichiers du core, aucun fichier produit.**

| Fichier | Changement |
| --- | --- |
| `domain/enum/kyc_enum.ts` | `DocumentPieceType` gagne `RCCM` et `DFE` |
| `domain/verification_requirements.ts` | **nouveau** — le catalogue de complétude |
| `domain/exceptions/incomplete_verification_file_exception.ts` | **nouveau** |
| `domain/exceptions/verification_not_applicable_exception.ts` | **nouveau** |
| `application/services/account_verification_service.ts` | **nouveau** |
| `application/dtos/account_verification.dto.ts` | **nouveau** — `Command` et `Result` |
| `application/usecases/mobile/submit_kyc_document.usecase.ts` | réduit à une délégation (D10) |
| `application/events/kyc_document_submitted.ts` | `+accountId`, `+ownerType`, `userId` nullable |
| `application/listeners/on_kyc_submitted_admin_broadcast.ts` | tolère `userId` nul |

Relevé au 2026-08-10 : les deux listeners ne lisent `userId` que dans un log d'erreur — le passage en
nullable ne les casse pas.

**Risque de régression** : le chemin KYC mobile est retouché une deuxième fois par D10, après que K1
vient de le stabiliser. Le filet est déjà écrit — les tests de K1 doivent passer **sans
modification** après la délégation.

### Flux de données — validé le 2026-08-10

Cas de l'entreprise qui dépose son RCCM aujourd'hui et son DFE plus tard.

**Premier appel** — `submit({ accountId: 'org-4d9e', pieces: [{ type: RCCM, file, reference }] })` :

1. lecture du compte → `ownerType = organisation`, `segment = enterprise`, mode progressif ;
2. refus si un dossier est déjà `PENDING` ou `APPROVED` ;
3. téléversement — même préfixe de stockage qu'aujourd'hui, clé `accountId` ;
4. création du dossier `ownerType = organisation`, `documentType = null` ;
5. écriture de la pièce `RCCM` avec sa `reference` ;
6. `requiredPieces(enterprise)` moins les pièces présentes → il manque `DFE` →
   `status = in_submission`, `next_action = DFE` ;
7. tentative numérotée, puis event.

**Second appel**, le jour où le DFE arrive — même chemin, mais l'étape 6 ne trouve plus rien de
manquant → `status = pending`, `next_action = IN_REVIEW`. Le dossier entre dans la file de revue.

Le `Result` rendu porte `status`, `nextAction` et `missingPieces` : le produit sait quoi demander
ensuite sans rien recalculer.

### Gestion des erreurs — validée le 2026-08-10

| Cas | Réponse |
| --- | --- |
| Compte inconnu | `AccountNotFoundException` |
| Compte marchand | `VerificationNotApplicableException` — D1 dit qu'un marchand n'a pas de KYB ; un refus explicite vaut mieux qu'un dossier orphelin que personne ne revoira |
| Dossier déjà `PENDING` / `APPROVED` | `KycAlreadySubmittedException`, réutilisée |
| Lot incomplet, **mode atomique** (`particulier`) | `IncompleteVerificationFileException`, listant les types manquants — comportement d'aujourd'hui |
| Lot incomplet, **mode progressif** (`enterprise`) | **Pas une erreur** : le dossier reste `in_submission`, `missingPieces` dit ce qui manque |
| Pièce fournie sans `reference` alors que son type l'exige | `IncompleteVerificationFileException` — une référence vide vaut une pièce absente (D12) |
| Type de pièce hors catalogue du segment | Refus : un `SELFIE` n'a rien à faire dans un dossier d'entreprise |

### Tests — validés le 2026-08-10

- le catalogue de complétude, par segment et par type de pièce d'identité, mode compris ;
- **le scénario RCCM puis DFE** : après le premier appel le dossier est `in_submission` avec
  `next_action = DFE` et n'apparaît pas dans la file de revue ; après le second il est `pending` ;
- soumission d'organisation avec référence vide → refusée comme une pièce absente ;
- soumission sur un compte marchand → `VerificationNotApplicableException` ;
- pièce hors catalogue du segment → refusée ;
- refus puis resoumission de la seule pièce en cause : le RCCM déjà présent n'est pas retouché (D14) ;
- l'event porte `accountId` et `ownerType`, avec `userId` nul pour une organisation ;
- **les tests KYC de K1 passent sans modification** — la preuve que la délégation D10 n'a pas
  déplacé le chemin identité.

**Design de K2 complet.**

---

## Lot K3 — Revue et palier

### Architecture — validée le 2026-08-10

#### Ce qui existe et ne peut pas être réutilisé tel quel

La chaîne d'approbation du KYC passe par le modèle `User` :

```
KycDocumentAdminService.process
  └─ event KycDocumentProcessed(userId)
       └─ OnUserKycStatusUpdate  →  UpdateUserKycStatus(userId, VERIFIED, niveau 2)
            └─ event UserKycStatusUpdated
                 └─ SyncAccountLevelOnKycUpdated  →  AccountService.setLevel(userId, 2)
```

Une organisation n'a pas de `User`. D'où D15.

#### Le core

- `KycDocumentProcessed` gagne `accountId` et `ownerType` ; `userId` devient nullable — même
  changement que l'event de soumission en K2.
- **Nouveau listener** `SyncAccountLevelOnVerificationProcessed`, dans
  `core/identity/account/application/listeners/` à côté de son jumeau : ne retient que
  `ownerType = organisation` et `status = APPROVED`, puis appelle
  `AccountService.setLevel(accountId, levelAfterApproval(segment))`.
- **Mapping `levelAfterApproval(segment)`** dans `core/identity/kyc/domain`, à côté du catalogue de
  complétude : `enterprise → 2`. Un refus ne touche pas au niveau, le compte reste à 0.
- `OnUserKycStatusUpdate` **ignore** les dossiers d'organisation — sans cette garde il appellerait
  `UpdateUserKycStatus` avec un `userId` nul.
- `KycDocumentAdminService` : le shim `findByUser` (D8) est retiré ; la file de revue devient
  filtrable par `ownerType` et le `Result` porte `accountId` et `ownerType`. Le core ne résout aucun
  libellé de propriétaire (D7).

#### Le produit `aiglebusiness`

Un listener produit écoute le même event et miroite `organisation.level = LEVEL_2` — produit → core
par event, autorisé.

### Gestion des erreurs — validée le 2026-08-10

| Cas | Réponse |
| --- | --- |
| Compte disparu à l'approbation | `AccountService.setLevel` est déjà no-op sur compte inconnu |
| Dossier approuvé, listener en échec | **Le risque du lot** : l'entreprise resterait bloquée au niveau 0 en silence. Garde-fou D16 — le back-office affiche statut du dossier et niveau du compte côte à côte, et les échecs du listener sont journalisés |
| Approbation d'un dossier déjà approuvé | Sans effet : `setLevel` est idempotent |

### Tests — validés le 2026-08-10

- approbation d'un dossier d'organisation → `account.level` passe à 2 et `organisation.level` à
  `LEVEL_2` ;
- refus → niveau inchangé, le compte reste à 0 ;
- approbation d'un dossier utilisateur → la chaîne existante est inchangée et le listener
  organisation ne se déclenche pas ;
- `OnUserKycStatusUpdate` ne s'exécute jamais avec un `userId` nul ;
- la file de revue liste les deux natures de dossier et se filtre par `ownerType` ;
- une entreprise passée au niveau 2 obtient bien des limites illimitées via `getStanding`.

**Design de K3 complet.**

---

## Lot K4 — Les présentations

### Architecture — validée le 2026-08-10

K4 ne porte **aucune règle métier** : toute la règle vit dans le core (K2 et K3). Les contrôleurs
valident, résolvent le compte, appellent, projettent.

#### Résolution du compte

`AccountService` gagne `getAccountId(ownerType, ownerRef): Promise<string | null>`. Le produit ne
suppose jamais `accountId == organisationId`, même si la dérivation le vérifie aujourd'hui.

#### Client owner — `aiglebusiness`

Un `kyb_routes.ts` calqué sur `funding_request_routes.ts`, avec la même chaîne de middlewares,
`requireEnterprise` compris — un marchand est refusé à la porte (D1).

| Route | Garde |
| --- | --- |
| `POST business/organisations/:organisationId/kyb/pieces` | `BUSINESS_PERMISSION.kybSubmit` |
| `GET business/organisations/:organisationId/kyb` — état, pièces présentes, `nextAction`, `missingPieces` | `BUSINESS_PERMISSION.kybView` |

Les deux permissions sont **déjà déclarées** depuis le chantier RBAC ; K4 est le premier à les
consommer.

#### Admin — `aiglebusiness` (D7)

L'onglet KYB rejoint `admin_organisation_routes.ts` :

| Route | Rôle |
| --- | --- |
| `GET admin/organisations/:organisationId/kyb` | Dossier, pièces **et niveau du compte côte à côte** — c'est là que vit le garde-fou D16 |
| `POST admin/organisations/:organisationId/kyb/decision` | Approbation ou refus, via le service core de revue |

Swagger est mis à jour dans le même lot, selon la convention du dépôt.

### RBAC — validé le 2026-08-10

Deux catalogues distincts sont en jeu, et ils ne se rejoignent pas.

#### Côté organisation — rien à déclarer

Une organisation est provisionnée avec un seul rôle système, `OWNER`, à qui
`seedForNewOrganisation` attribue `allPermissionSlugs()`. `kyb:submit` et `kyb:view` sont donc **déjà
les siennes**, et les autres rôles se composent depuis le catalogue par l'owner. K4 **consomme** ces
deux permissions, il n'en déclare aucune.

Les niveaux de sensibilité en place sont conservés : `kyb:submit` reste `sensitive: false` — c'est
une saisie, dont l'effet est verrouillé derrière la revue — et `kyb:view` reste `sensitive: true`,
puisqu'il expose les pièces légales de l'entreprise.

#### Côté back-office — un groupe dédié (D17)

`ORGANISATION_KYB_PERMISSIONS` rejoint
`aiglebusiness/organisation/presentation/admin/permissions.config.ts`, sur la forme de
`KYC_PERMISSIONS` :

| Slug | Rôle | `sensitive` |
| --- | --- | --- |
| `organisations.kyb.read` | Consulter le dossier de vérification d'une entreprise et ses pièces | `true` |
| `organisations.kyb.approve` | Approuver — fait passer l'entreprise du niveau 0 aux plafonds illimités | `true` |
| `organisations.kyb.reject` | Refuser avec motif et demander une nouvelle soumission | `true` |

Séparer `approve` de `reject` reprend la raison déjà écrite dans `KYC_PERMISSIONS` : un agent peut
être habilité à rejeter une pièce non conforme sans pouvoir valider.

`organisations.kyb.read` garde le `GET`, `approve` et `reject` gardent le `POST` de décision selon
le sens de la décision portée.

#### Tests RBAC

- 403 sur le `GET` admin sans `organisations.kyb.read` ;
- 403 sur une approbation avec `organisations.kyb.reject` seul, et symétriquement ;
- un agent porteur de `kyc_documents.approve` **seul** ne peut pas approuver un KYB — c'est la
  garantie de D17 ;
- l'owner d'une organisation fraîchement créée peut soumettre et consulter sans configuration.

### Tests — validés le 2026-08-10

- 403 sans `kyb:submit`, 403 sans `kyb:view` ;
- refus sur une organisation marchande (`requireEnterprise`) ;
- dépôt RCCM puis DFE de bout en bout, le dossier passant `in_submission` → `pending` ;
- approbation admin → niveau 2 visible sur le compte ;
- 404 cross-organisation.

**Design de K4 complet.**

---

## Hors scope de ce chantier

- **Compléter la grille `kyc_level`** — D1 la rend inutile : aucun palier ne manque.
- **Vérification automatique auprès d'un registre** (RCCM OHADA). D12 pose le champ structuré qui la
  rendra possible ; le chantier ne l'implémente pas.
- **Validité par pièce** (D11) et **statut par pièce** (D14).
- **Drop des colonnes `document_recto_url` / `verso` / `selfie`** (D5) — après stabilisation, hors
  de ce chantier.
- **Renommage de `kyc_documents`** (U4) — à trancher en fin de K1, hors chemin critique.
- **KYB du marchand** (D1) — il n'en a pas.

## Inconnues restantes

| # | Inconnue | Résolution |
| --- | --- | --- |
| U4 | Le nom `kyc_documents` pour une table qui n'est plus spécifique au KYC | En fin de K1, une fois le rayon d'impact réel connu |

---

## Clôture

Design **approuvé le 2026-08-10**, étapes 0 à 5 du processus de brainstorming parcourues.
Code re-vérifié à l'approbation : aucun commit sur `app/` ni `database/` pendant la session.

Le RBAC a été traité en fin de session, à la demande de l'utilisateur, comme une section de K4
(D17) — extension de périmètre assumée plutôt qu'absorbée en silence.

Prochaine étape : `writing-plans` sur le **lot K1**, le seul qui ne dépend d'aucun autre.