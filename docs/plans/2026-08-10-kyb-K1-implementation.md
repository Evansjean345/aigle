---
type: implementation-plan
statut: à faire
derniere_maj: 2026-08-10
lot: K1 — socle « vérification de compte »
design: docs/plans/2026-08-10-verification-compte-kyb-design.md (registre D0→D17)
branche: feat/core-consolidation
---

# Plan d'implémentation — Socle « vérification de compte » (Lot K1)

Découpage TDD en cinq slices **S1→S5**. Chaque slice : **test rouge d'abord**, puis implémentation
jusqu'au vert, sans régression. L'ordre suit les dépendances — domaine, persistance, écriture,
lecture, frontière de service.

**K1 est fonctionnellement invisible.** À la fin du lot, le KYC identité se comporte exactement comme
avant : même contrat HTTP, mêmes exceptions, mêmes réponses. Seul le stockage des pièces a changé.
C'est le critère d'acceptation du lot, et c'est ce que les tests existants doivent prouver **sans
être modifiés dans leurs assertions métier**.

## Préconditions & conventions

- **Migrations lancées par l'utilisateur** (jamais par l'agent) : après avoir écrit un fichier de
  migration, s'arrêter et demander `node ace migration:run`.
- **Aucun backfill de données** (D4) : les dossiers antérieurs ne sont jamais réécrits. Si une
  migration de ce lot contient un `UPDATE` sur des lignes existantes, c'est une erreur.
- **Nommage** (D6) : table `document_pieces`, modèle `DocumentPiece`, enum `DocumentPieceType`. Ne
  pas préfixer par `kyc`.
- **Documentation** : `docs/rules/2026-07-29-jsdoc-documentation-rules.md` — le commentaire dit ce
  que fait le code, sans le justifier ni renvoyer à un numéro de lot. À vérifier sur chaque fichier
  muté.
- **Frontières de service** : `docs/rules/2026-08-03-service-boundary-rules.md` — un service passe
  par un repository et rend un `Result`. L'atomicité appartient au repository qui écrit.
- **Commandes de test** (japa) :
  - unit : `node ace test --files="unit/kyc/..."`
  - suite complète : `node ace test`
- **Baselines à ne pas dégrader** : `tsc` 57 erreurs, `depcruise` 0 erreur, 584 tests passés /
  5 échecs préexistants (Kyc ×2, ProviderErrorService, DeviceService). Les 2 échecs KYC sont
  **hors périmètre** — ils doivent rester les seuls rouges de la suite kyc.

---

## Migrations (à écrire ; lancées par l'utilisateur)

| #  | Migration | Contenu |
|----|-----------|---------|
| M1 | `create_document_pieces_table` | `id` (increments), `kyc_document_id` (fk index), `piece_type` (varchar), `file_url` (text), `reference` (varchar, null), timestamps. Unique `(kyc_document_id, piece_type)` |
| M2 | `add_owner_type_to_kyc_documents` | ADD `owner_type` (varchar, défaut `user`, indexé) ; `account_id` passe NOT NULL ; `document_type` passe nullable. **`user_id` conservé** |
| M3 | `add_account_id_to_kyc_attemps` | ADD `account_id` (uuid, nullable, indexé) + backfill `= user_id` ; `document_type` passe nullable |

M3 est le **seul** `UPDATE` autorisé du lot : il remplit une colonne neuve depuis une colonne
existante de la même ligne, exactement comme `add_account_id_to_kyc_documents` l'a fait. Il ne
touche à aucune donnée métier.

⚠️ M2 rend `account_id` NOT NULL : vérifier d'abord qu'aucune ligne n'a `account_id IS NULL`
(la migration de backfill est censée les avoir toutes remplies). Si des lignes traînent, les
remplir avant d'ajouter la contrainte.

---

## S1 — Domaine : la pièce existe

**Objectif.** `DocumentPiece`, `DocumentPieceType`, et `KycDocument` qui sait porter des pièces.

**Test rouge d'abord** — `tests/unit/kyc/document_piece.spec.ts` :

- `DocumentPieceType` expose `RECTO`, `VERSO`, `SELFIE` (les valeurs KYB arrivent en K2) ;
- un `KycDocument` hydraté avec des pièces les expose via sa relation ;
- `KycDocument.ownerType` accepte les deux valeurs d'`AccountOwnerType`.

**Implémentation.**

- `app/core/identity/kyc/domain/models/document_piece.ts` — modèle, `belongsTo(KycDocument)`.
- `app/core/identity/kyc/domain/enum/kyc_enum.ts` — `DocumentPieceType`.
- `app/core/identity/kyc/domain/models/kyc_document.ts` — `+accountId`, `+ownerType`
  (`AccountOwnerType`, importé comme vocabulaire de domaine), `hasMany(DocumentPiece)`,
  `documentType` devient optionnel.
- `app/core/identity/kyc/domain/models/kyc_attemp.ts` — `+accountId`, `documentType` optionnel.

**Vérification.** `depcruise` reste à 0 : l'import d'`AccountOwnerType` depuis
`identity/account/domain/enums` est un franchissement de vocabulaire, autorisé règle 5.

---

## S2 — Persistance : le port parle compte

**Objectif.** Le repository sait trouver un dossier par compte et écrire dossier + pièces
atomiquement.

**Test rouge d'abord** — `tests/unit/kyc/kyc_document_repository.spec.ts` :

- `findByAccountId` retrouve le dossier d'un compte utilisateur (invariant β) ;
- `saveWithPieces` écrit dossier et pièces, et **ne laisse rien** si l'écriture d'une pièce échoue ;
- une resoumission remplace les pièces sans les dupliquer (unicité `(dossier, piece_type)`) ;
- `findLastAttempt` numérote **par dossier** et non par `(user_id, document_type)`.

**Implémentation.**

- `domain/interfaces/kyc_document_repository.ts` — `findUserKycDocument` devient
  `findByAccountId(accountId)` ; ajout de `saveWithPieces(document, pieces)` ; `findLastAttempt`
  prend le dossier.
- `infrastructure/repositories/kyc_document_repository_impl.ts` — requêtes sur `account_id`,
  `preload('pieces')` sur `findById` / `findAll` / `findByAccountId`, transaction dans
  `saveWithPieces`.

**Attention.** Les mocks manuels du port dans `tests/unit/kyc/*.spec.ts` implémentent l'interface
entière : ajouter une méthode au port **casse leur compilation**. C'est attendu — les mettre à jour
fait partie de la slice.

---

## S3 — Écriture : la soumission produit des pièces

**Objectif.** `SubmitKycDocumentUsecase` écrit des pièces et n'écrit plus les trois colonnes.

**Test rouge d'abord** — `tests/unit/kyc/submit_kyc_document.spec.ts` (étendu) :

- une soumission CNI crée **3 pièces** (`RECTO`, `VERSO`, `SELFIE`) et laisse
  `document_recto_url` / `verso` / `selfie` intactes ;
- une soumission PASSPORT crée **2 pièces** (`RECTO`, `SELFIE`), sans `VERSO` ;
- le dossier est écrit avec `ownerType = user` ;
- **non-régression** : les assertions existantes (`KycAlreadySubmittedException`,
  `MissingKycDocumentsException`, règle passeport) passent **inchangées**.

**Implémentation.**

- `application/usecases/mobile/submit_kyc_document.usecase.ts` — le paramètre `userId` devient
  `accountId` ; les URL téléversées deviennent des pièces ; l'appel de persistance passe par
  `saveWithPieces`.
- `presentation/mobile/controllers/kyc_submittion_controller.ts` — passe `auth.user.usersUid` comme
  `accountId`.

Les chemins de stockage restent inchangés **en valeur** : `accountId == usersUid` pour un compte
utilisateur.

---

## S4 — Lecture : la projection et son repli

**Objectif.** Le `Result` expose les pièces, et les dossiers antérieurs à K1 restent lisibles.

**Test rouge d'abord** — `tests/unit/kyc/kyc_document_admin_dto.spec.ts` :

- un dossier **avec** pièces projette `pieces[]` depuis la relation ;
- un dossier **sans** pièce mais avec ses trois colonnes projette **les mêmes `pieces[]`**, dérivées
  des colonnes (repli D4) — c'est le test qui garantit que rien ne disparaît du back-office ;
- un dossier sans pièce ni colonne projette une liste vide, sans lever ;
- `accountId`, `ownerType` sont présents ; `userId` et `user` **le sont toujours**.

**Implémentation.**

- `application/dtos/kyc_document_admin.dto.ts` — `KycDocumentResult` gagne `accountId`, `ownerType`,
  `pieces[]` ; `toKycDocumentResult` porte le repli, **en un seul endroit** — aucun appelant ne doit
  le réimplémenter.

---

## S5 — Frontière : le service admin parle compte

**Objectif.** `KycDocumentAdminService` est ancré compte, sans qu'aucun fichier produit ne bouge.

**Test rouge d'abord** — `tests/unit/kyc/process_kyc_document.spec.ts` (étendu) :

- `findByAccountId` sert la lecture ;
- le shim `findByUser(userId)` (D8) rend le même dossier que `findByAccountId(userId)` ;
- la décision de revue écrit une tentative numérotée **par dossier** ;
- **non-régression** : les assertions existantes passent inchangées.

**Implémentation.**

- `application/services/kyc_document_admin_service.ts` — `accountId` partout ; `findByUser` conservé
  comme délégation ; la tentative de décision reprend la numérotation par dossier.

Aucun fichier de `app/products/` n'est touché par ce lot. Si l'un doit l'être, c'est le signe que
D8 n'a pas été appliquée — s'arrêter et le signaler.

---

## Vérification de fin de lot

1. `node ace test` — 584 passés, **les 5 mêmes échecs** qu'au départ, aucun nouveau.
2. `npm run depcruise` — 0 erreur.
3. `tsc` — 57 erreurs, pas 58.
4. `git diff --stat app/products/` — **vide**.
5. Le `POST /kyc` mobile répond comme avant, avec le même payload et le même corps.

## Ce que K1 ne fait pas

Aucun type de pièce KYB, aucune route, aucun effet sur les paliers, aucun drop de colonne, aucun
backfill de pièces. U4 (renommage de `kyc_documents`) se tranche **à la fin** de ce lot, une fois le
rayon d'impact réel constaté.