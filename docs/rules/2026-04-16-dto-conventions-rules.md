# Convention DTO — Rules

**Date** : 2026-04-16
**Statut** : Validé
**Scope** : `app/core/{feature}/application/dtos/` et `app/products/{app}/{feature}/application/dtos/` (Lot 5 : couches physiques core/products ; alias `#core/*`, `#aiglesend/*`)

---

## Règle 1 — Dossier canonique

Le dossier est toujours `dtos/` (avec le `s`), jamais `dto/`.

```
app/core/{feature}/application/dtos/
```

---

## Règle 2 — Un fichier par domaine fonctionnel

Chaque fichier regroupe tous les DTOs d'un même domaine fonctionnel. Le nommage suit le pattern `{domaine}.dto.ts`. Pour les DTOs admin, le préfixe `admin_` est ajouté.

```
dtos/
├── wallet.dto.ts                      # DTOs mobile wallet
└── admin/
    ├── admin_wallet.dto.ts            # DTOs admin wallet généraux
    └── admin_wallet_adjustment.dto.ts # DTOs admin adjustment
```

---

## Règle 3 — Organisation des sous-dossiers

- Racine `dtos/` : DTOs mobile (cas par défaut)
- Sous-dossier `dtos/admin/` : DTOs admin
- Pas de sous-dossier `mobile/` ni `shared/`

---

## Règle 4 — Interface vs Classe

- **Interface** : quand le DTO est une structure de données pure, sans transformation (passe les données telles quelles)
- **Classe** avec `static fromX()` : quand le DTO transforme, enrichit ou mappe les données (snake_case → camelCase, injection de dépendances contextuelles, mapping depuis un model)

```ts
// Interface — aucune transformation
export interface UpdateWalletStatusCommand {
  userId: string
  status: WalletStatus
}

// Classe — mapping nécessaire
export class WalletAdjustmentResponseDTO {
  declare adjustmentUid: string
  // ...
  static fromAdjustment(adjustment: WalletAdjustment): WalletAdjustmentResponseDTO { ... }
}
```

---

## Règle 5 — Suffixes par rôle

| Rôle | Suffixe | Exemple | Format |
|------|---------|---------|--------|
| Input HTTP (controller → use case) | `RequestDto` | `ExecuteWalletAdjustmentRequestDto` | interface ou class |
| Input écriture (use case → service / port) | `Command` | `WalletAdjustmentCommand` | interface ou class |
| Input lecture (use case → service / port) : critères, filtres, pagination | `Query` | `ListProvidersQuery` | interface |
| Output service → use case | `Result` | `WalletAdjustmentResult` | interface |
| Output HTTP vers le client | `ResponseDTO` | `WalletAdjustmentResponseDTO` | class avec `static fromX()` |

> `RequestDto` / `ResponseDTO` sont RÉSERVÉS à la frontière HTTP. Un « request » de lecture côté
> service/port est une `Query`, jamais un `RequestDto`. Placement selon la couche propriétaire :
> voir [placement des types & contrats](./2026-07-05-type-placement-rules.md).

> Un `Result` ne contient **jamais** de modèle ORM, ni comme type de retour ni comme champ : voir
> [frontières de service](./2026-08-03-service-boundary-rules.md). L'exemple 2 ci-dessous en expose
> un (`WalletAdjustmentResult.walletAdjustment`) — c'est de la dette, pas un modèle à suivre.

---

## Règle 6 — Structure interne d'un fichier DTO

Les DTOs sont ordonnés par flux de données : inputs d'abord, outputs ensuite, séparés par des commentaires de section.

```ts
// ── RequestDto (input use case) ─────────────────────────────────────
export interface ExecuteWalletAdjustmentRequestDto { ... }

// ── Command (input service) ─────────────────────────────────────────
export interface WalletAdjustmentCommand { ... }

// ── Result (output service) ─────────────────────────────────────────
export interface WalletAdjustmentResult { ... }

// ── Response (output HTTP) ──────────────────────────────────────────
export class WalletAdjustmentResponseDTO { ... }
```

---

## Règle 7 — Seuil de split

Un fichier DTO ne doit pas dépasser **~400 lignes**. Au-delà, découper par sous-domaine fonctionnel.

---

## Arbre de décision

```
Nouveau DTO à créer
│
├─ C'est pour l'espace admin ?
│   ├─ OUI → dtos/admin/admin_{domaine}.dto.ts
│   └─ NON → dtos/{domaine}.dto.ts
│
├─ Le fichier cible existe déjà ?
│   ├─ OUI et < 400 lignes → ajouter dans le fichier existant
│   ├─ OUI et > 400 lignes → splitter par sous-domaine
│   └─ NON → créer le fichier
│
├─ Quel suffixe ?
│   ├─ Données entrantes du controller vers le use case → RequestDto
│   ├─ Données entrantes du use case vers le service → Command
│   ├─ Données sortantes du service vers le use case → Result
│   └─ Données sortantes vers le client HTTP → ResponseDTO
│
└─ Interface ou Classe ?
    ├─ Aucune transformation (passe-plat) → interface
    └─ Mapping / enrichissement (fromX) → class
```

---

## Exemples de référence

### Exemple 1 — Feature simple (admin wallet status)

Fichier : `dtos/admin/admin_wallet.dto.ts`

```ts
import { type WalletStatus } from '#core/wallet/domain/enums/wallet_status'

// ── Command (input service/use case) ────────────────────────────────

export interface UpdateWalletStatusCommand {
  userId: string
  status: WalletStatus
}
```

Interface pure — aucune transformation, pas de mapping.

### Exemple 2 — Feature complexe (wallet adjustment)

Fichier : `dtos/admin/admin_wallet_adjustment.dto.ts`

```ts
import type { DateTime } from 'luxon'
import type WalletAdjustment from '#core/wallet/domain/models/wallet_adjustment'
import type { AdjustmentType, AdjustmentReason } from '#core/wallet/domain/enums/wallet_adjustment'
import type Transaction from '#core/transactions/domain/models/transaction'

// ── RequestDto (input use case) ─────────────────────────────────────

export interface ExecuteWalletAdjustmentRequestDto {
  walletId: number
  type: AdjustmentType
  reason: AdjustmentReason
  amount: number
  comment: string
  adminId: number
  transactionReference?: string
}

// ── Command (input service) ─────────────────────────────────────────

export interface WalletAdjustmentCommand {
  walletId: number
  type: AdjustmentType
  reason: AdjustmentReason
  amount: number
  comment: string
  adminId: number
  transaction?: Transaction | null
}

// ── Result (output service) ─────────────────────────────────────────

export interface WalletAdjustmentResult {
  walletAdjustment: WalletAdjustment
  balanceBefore: number
  balanceAfter: number
}

// ── Response (output HTTP) ──────────────────────────────────────────

export class WalletAdjustmentResponseDTO {
  declare adjustmentUid: string
  declare walletId: number
  // ...
  static fromAdjustment(adjustment: WalletAdjustment): WalletAdjustmentResponseDTO { ... }
}
```

---

## Migration

- **Nouveau code** : applique ces règles immédiatement
- **Code existant** : aligner les DTOs d'une feature quand on la touche (bug fix, nouvelle fonctionnalité)
- **Pas de PR dédiée** "refactor DTOs" qui touche plusieurs features d'un coup
