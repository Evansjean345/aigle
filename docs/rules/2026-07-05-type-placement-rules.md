# Placement des types & contrats par couche — Rules

**Date** : 2026-07-05
**Statut** : Validé
**Scope** : toutes les features `app/core/{feature}/` et `app/products/{app}/{feature}/`
**Contexte** : durcissement DDD strict (Lot 5+), objectif d'extractibilité de chaque feature en unité autonome.

---

## Principe fondateur

> Un type ou contrat de données vit dans **la couche la plus basse qui le référence dans une signature**, jamais dans la couche qui le « traverse » ou l'exécute.

Le critère n'est **pas** la destination (« ce type part vers l'infrastructure ») mais la **propriété** : quelle couche déclare ce contrat. Un port repository est du **domaine** ; son implémentation en infrastructure ne fait que le consommer (flèche `infra → domain`, jamais l'inverse).

---

## Règle 1 — Tableau de placement

| Le type est référencé par… | Il vit dans… | Forme |
|---|---|---|
| un **port** (`domain/interfaces/`) — Command, Query/Filter d'un repository | `domain/types/` | `interface` |
| un **concept métier** à valeurs finies (statut, type, catégorie) | `domain/enums/` | `type` union ou `enum` |
| un **concept métier porteur d'invariants** (Money, PhoneNumber, ProviderRequest) | `domain/value_objects/` | `class` + factory `create()` validante |
| une **entité persistée** | `domain/models/` | model Lucid |
| un **contrat de dépendance** (port de service, repository) | `domain/interfaces/` | `abstract class` |
| seulement un **service / use case** (payload d'event, données d'orchestration) | `application/types/` | `interface` / `type` |
| la **frontière HTTP** (input requête, output réponse) | `application/dtos/` | voir [conventions DTO](./2026-04-16-dto-conventions-rules.md) |

---

## Règle 2 — `types` ≠ `value_objects`

Ne pas ranger un contrat plat dans `value_objects/`, et inversement.

- **`domain/types/`** : une **forme de données** — aucun invariant, aucun comportement, aucune garantie. Interface plate (`Command`, `Query`, `Filter`, config). La validation se fait ailleurs (Vine à la frontière HTTP).
- **`domain/value_objects/`** : un **concept du domaine** — invariants validés à la construction (impossible d'en créer un invalide), immuable, comportement (égalité par valeur, opérations). Classe avec factory `create()`.

Fusionner les deux fait perdre l'information qui compte : *« cet objet garantit-il quelque chose, ou est-ce juste une forme ? »*. Un type mérite d'être **promu** en value object seulement quand on veut lui attacher des invariants (ex. `code: string` → `ProviderCode`).

---

## Règle 3 — Suffixes de nommage par intention (CQRS interne)

Le **suffixe** dit le rôle et la couche. Discipline stricte :

| Suffixe | Rôle | Direction | Lecture / Écriture |
|---|---|---|---|
| `RequestDto` | payload HTTP entrant | HTTP → controller | — |
| `ResponseDTO` | payload HTTP sortant | usecase → HTTP | — |
| `Command` | intention de **mutation** | usecase → service / **port** | écriture |
| `Query` | demande de **lecture** (critères, filtres, pagination) | usecase → service / **port** | lecture |
| `Result` | retour d'un service / usecase | service → usecase | — |
| `Event` | fait accompli | émetteur → listeners | — |

Règles de discipline :

- **`RequestDto` / `ResponseDTO` sont RÉSERVÉS à la frontière HTTP** (controller). Interdit dans un port, un service ou le domaine. Un « request de lecture » côté port est une **`Query`**, pas un `RequestDto`.
- **`Command` (écriture)** et **`Query` (lecture)** sont les contrats internes entre usecase, service et port. C'est la distinction CQRS.
- `Result` = ce qu'un service renvoie au usecase.
- Anti-exemple corrigé (durcissement #4) : `ListProvidersRequestDto` (un « request » de lecture placé dans le domaine) → renommé `ListProvidersQuery`.

## Règle 3bis — Le `Command` / `Query` ambigu

`Command` et `Query` peuvent vivre à deux endroits selon **qui les consomme** :

- consommé par un **service / use case** de l'application → `application/dtos/` (convention DTO)
- consommé par un **port repository** (`domain/interfaces/`) → `domain/types/` (sinon le domaine dépendrait de l'application — inversion cassée)

Le facteur discriminant reste le Principe fondateur : la couche la plus basse qui le déclare.

---

## Règle 4 — Sous-dossiers `domain/` canoniques

Sous `domain/`, uniquement ces sous-dossiers ; **pas** de fichier `enums.ts` / `types.ts` en vrac à la racine de `domain/`.

```
domain/
├── models/          # entités Lucid
├── interfaces/      # ports (repository, service) — abstract class
├── enums/           # énumérations métier
├── types/           # contrats de données plats (Command/Query de port, config)
├── value_objects/   # concepts à invariants — class + create()
└── exceptions/      # exceptions métier (cf. durcissement #1)
```

> Dette connue : quelques features ont encore des fichiers racine (`user/domain/enum.ts`, `device/domain/enums.ts`, `audit/domain/enums.ts`, `ledger/domain/ledger_enums.ts`, `fees/domain/fee_types.ts`, `notifications/domain/notification_channel_type.ts`). À uniformiser vers `domain/enums/` au fil des touches.

---

## Règle 5 — Ré-export de compat

Quand un type déjà largement importé depuis un DTO application doit descendre en `domain/` (durcissement), le DTO application le **ré-exporte** depuis le domaine :

```ts
// application/dtos/admin/admin_providers.dto.ts
export type { ProviderType, ProviderStatus } from '#core/{feature}/domain/enums/provider_enums'
export type { CreateProviderCommand } from '#core/{feature}/domain/types/provider_repository_types'
```

Ainsi le domaine ne dépend plus de l'application, sans casser les controllers/use cases (qui importent toujours depuis le DTO).

---

## Arbre de décision

```
Nouveau type / contrat à placer
│
├─ C'est une entité persistée ?           → domain/models/
├─ Un port (repository/service) ?         → domain/interfaces/
│
├─ Une énumération métier ?               → domain/enums/
├─ Un concept avec invariants à valider ? → domain/value_objects/ (class + create)
│
├─ Un contrat référencé par un PORT domain (Command/Query repo) ?
│                                          → domain/types/
├─ Un payload d'event / donnée d'orchestration (application seule) ?
│                                          → application/types/
└─ Un input/output HTTP (RequestDto/ResponseDTO) ?
                                           → application/dtos/  (conventions DTO)
```

---

## Exemple de référence — catalogs (durcissement #4)

Avant : `domain/models/provider.ts` et `domain/interfaces/provider_repository.ts` importaient `ProviderType`, `CreateProviderCommand`, etc. depuis `application/dtos/admin/admin_providers.dto.ts` → inversion `domain → application` + cycle model↔dto.

Après :
- `ProviderType`, `ProviderStatus` → `domain/enums/provider_enums.ts`
- `ListProvidersRequestDto`, `Create/UpdateProviderCommand` (contrat du port) → `domain/types/provider_repository_types.ts`
- le DTO application ré-exporte (Règle 5)

Résultat : `domain/` autonome, `presentation → application → domain` respecté.

---

## Exemption — DTO applicatif ↔ validator Vine (contrat de payload)

Un DTO applicatif (`application/dtos/*.dto.ts`) peut **importer-TYPE** le validator
Vine de présentation dont il dérive la forme du payload :

```ts
import type { Infer } from '@vinejs/vine/types'
import { type depositValidator } from '#aiglesend/operations/presentation/mobile/validators/deposit_validator'

static fromRequest(payload: Infer<typeof depositValidator>, ...) { ... }
```

**Pourquoi c'est toléré** (contre la règle générale `application ⇏ presentation`) :
- Le schéma Vine **est** la source de vérité du contrat de payload HTTP ; le dupliquer
  côté application créerait deux définitions à maintenir en phase.
- Le couplage est **strictement type-only** (`import type` / `Infer<>`) : aucune
  dépendance runtime, rien n'est exécuté depuis la présentation.

**Bornes de l'exemption** (encodées dans `.dependency-cruiser.cjs`, règle
`application-sans-infra-ni-presentation`, `to.pathNot: '/presentation/.*/validators/'`) :
- N'exempte QUE les imports vers `presentation/**/validators/` — tout autre import
  application → `presentation/` ou → `infrastructure/` reste interdit.
- Réservé aux imports **type-only**. Un import runtime d'un validator depuis
  l'application est un signal à revoir (déplacer la logique en présentation).

---

## Migration

- **Nouveau code** : applique ces règles immédiatement.
- **Code existant** : corrige le placement d'une feature quand tu la touches (bug fix, feature) — cf. durcissement DDD par contexte.
- **Pas de PR dédiée** « déplacement massif de types » qui touche plusieurs features d'un coup, hors passe de durcissement planifiée.
