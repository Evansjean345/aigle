# Frontières de service — Rules

**Date** : 2026-08-03
**Statut** : Validé
**Scope** : tout service de `application/services/` — `app/core/` et `app/products/`

---

## Principe fondateur

> Un service **lit et écrit par un repository**, et **rend un `Result`**. Il ne touche pas le modèle
> en entrée, il ne le laisse pas fuiter en sortie.

Le cap est l'extractibilité : chaque contexte doit pouvoir devenir un service autonome. Les deux
faces comptent.

En **entrée**, un service qui appelle `Model.query()` grave une décision de persistance dans la
couche applicative : le jour où la donnée passe derrière une API ou change de stockage, c'est le
service qu'il faut réécrire, pas son repository.

En **sortie**, un modèle qui franchit une frontière emporte tout avec lui — ses colonnes, ses
relations chargées ou non, ses méthodes de persistance. L'appelant peut le sauvegarder, naviguer
vers une relation absente, ou dépendre d'une colonne que la feature propriétaire croyait interne.

Le test à s'appliquer : **ce que je manipule et ce que je rends passeraient-ils le réseau ?**

---

## Règle 1 — Un service passe par un repository

Aucun accès direct au modèle depuis un service : ni `query()`, ni `find*()`, ni `create()`, ni
`new Model()` suivi de `save()`.

```ts
// ❌ la requête vit dans le service
const wallet = await Wallet.query().where('account_id', accountId).first()

// ✅ le port porte l'intention, l'implémentation porte la requête
const wallet = await this.walletRepository.findByAccountId(accountId)
```

Si le repository n'expose pas ce qu'il faut, on **ajoute une méthode au port** — on ne contourne
pas. Le nom de la méthode dit l'intention métier (`findByAccountId`, `countActiveByRole`), pas la
requête.

**Exception : l'API `accessTokens` d'AdonisJS.** `User.accessTokens.all/create/delete` est attachée
statiquement au modèle par le framework d'authentification ; aucun repository ne peut l'envelopper
sans réécrire le mécanisme de jetons. Les services d'authentification l'utilisent directement. C'est
la seule exception, et elle ne couvre que les jetons — les autres accès de ces services suivent la
règle.

---

## Règle 2 — Le retour est un `Result`

```ts
// ❌ le modèle traverse la frontière
async updateWalletStatusByAccountId(accountId: string, status: WalletStatus): Promise<Wallet>

// ✅ une projection minimale
async updateWalletStatusByAccountId(
  accountId: string,
  status: WalletStatus
): Promise<WalletStatusResult>
```

Le `Result` vit dans `application/dtos/{domaine}.dto.ts`, avec sa fonction de projection :

```ts
export interface WalletStatusResult {
  walletsUid: string
  status: WalletStatus
}

export const toWalletStatusResult = (wallet: Wallet): WalletStatusResult => ({
  walletsUid: wallet.walletsUid,
  status: wallet.status,
})
```

---

## Règle 3 — Le `Result` est minimal

Il porte ce que l'appelant consomme, pas la table. Un appelant qui gèle un portefeuille n'a besoin
ni du solde, ni du porteur, ni de l'`id` ORM.

Ajouter un champ « au cas où » ramène le problème : la frontière redevient une copie du modèle.

Le `Result` n'expose jamais l'`id` ORM. L'identifiant public (`walletsUid`, `organisationId`,
`accountId`) est ce qui survivrait à une extraction ; l'auto-incrément, non.

---

## Règle 4 — Un `Result` ne contient pas de modèle

L'interdiction porte sur le contenu, pas seulement sur le type de retour.

```ts
// ❌ le modèle passe quand même, encapsulé
export interface WalletAdjustmentResult {
  walletAdjustment: WalletAdjustment
  balanceBefore: number
}

// ✅
export interface WalletAdjustmentResult {
  adjustmentUid: string
  type: AdjustmentType
  balanceBefore: number
  balanceAfter: number
}
```

---

## Règle 5 — Les frontières concernées, aujourd'hui

Trois franchissements ne tolèrent aucun modèle :

| Franchissement      | Exemple                                    | Outillage                                       |
| ------------------- | ------------------------------------------ | ----------------------------------------------- |
| produit → core      | `aiglebusiness` consommant `WalletService` | `produit-consomme-core-par-service` **[ERROR]** |
| contexte → contexte | `money` consommant un service d'`identity` | `money-independant-de-identity` **[WARN]**      |
| core → produit      | interdit en totalité                       | `core-ne-depend-pas-du-produit` **[ERROR]**     |

Le premier est le seul entièrement outillé : dependency-cruiser refuse qu'un produit importe un
modèle, un repository ou l'infrastructure du core. Les autres reposent sur la relecture.

Un enum ou un value object du domaine reste importable à travers une frontière : c'est du
vocabulaire, pas un objet de persistance.

---

# Les invariants outillés

`.dependency-cruiser.cjs` est la version exécutable de ces frontières : `npm run depcruise`. Ce qui
suit en est la lecture — la configuration reste la source de vérité.

## La structure physique

```
app/
├── products/<app>/<feature>/          aiglesend · aiglebusiness
├── core/
│   ├── money/<feature>/               money_movement · transactions · wallet · ledger
│   │                                  fees · risk · webhooks · provider_gateway · transfer
│   ├── identity/<feature>/            user · authentication · account · otp · device · kyc
│   ├── catalog/<feature>/             catalogs · country
│   └── audit | notifications | team | qr      supporting, dépendables par tous
└── shared/
```

Chaque feature porte ses quatre couches : `domain/`, `application/`, `infrastructure/`,
`presentation/`.

## Les douze règles

### Les trois invariants — [ERROR], zéro violation

Ceux-là sont tenus et doivent le rester : une violation casse la commande.

| Règle                                             | Ce qu'elle interdit                                                                  | Pourquoi                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `core-ne-depend-pas-du-produit`                   | `app/core/` ou `app/shared/` important `#aiglesend/…` ou `#aiglebusiness/…`          | Condition de l'extractibilité du core. Le produit connaît le core ; jamais l'inverse.                                                 |
| `produit-consomme-core-par-service`               | un produit important `domain/models/`, un `*repository` ou `infrastructure/` du core | Le produit consomme le core **par ses services et ses DTOs**. C'est l'anti-corruption : la frontière reste un contrat, pas une table. |
| `identity-authentification-ne-depend-pas-de-team` | `identity/authentication` important `#core/team/`                                    | L'authentification des utilisateurs ne connaît pas le back-office ; l'auth admin vit dans `core/team/authentication`.                 |

`produit-consomme-core-par-service` est la règle qui outille la **règle 2** de ce document du côté
produit : rendre un modèle depuis un service du core provoque, chez l'appelant produit, un import
interdit. C'est indirect mais efficace — c'est ainsi qu'un `Wallet` exposé dans un DTO
d'`aiglebusiness` a été rattrapé.

### Les frontières de contexte — [WARN], durcissement en cours

| Règle                                      | Violations | Ce qu'elle vise                                                                |
| ------------------------------------------ | ---------- | ------------------------------------------------------------------------------ |
| `money-independant-de-identity`            | **16**     | La couche non-domaine de `money` ne connaît pas `identity`.                    |
| `identity-independant-de-money`            | **12**     | La réciproque.                                                                 |
| `catalog-independant-des-contextes-metier` | 0          | Le référentiel reste autonome : `catalog` ne connaît ni `money` ni `identity`. |

Deux décisions d'architecture (2026-07-07) expliquent leur forme :

**Les `domain/models` sont un shared kernel assumé.** Les relations Lucid inter-contexte —
`User ↔ Wallet`, `Transaction ↔ Ledger`, avec leurs clés étrangères, leurs `preload` et leur
atomicité — sont légitimes. Les règles exemptent donc `from: domain/models`. Seules les couches
`application`, `infrastructure` et `presentation` sont tenues à la frontière stricte.

**`catalog` est un référentiel en lecture.** Pays et catalogue provider sont de la donnée de
référence, lisible par tout contexte : la règle « money/identity ⇏ catalog » a été retirée. Seul
l'inverse subsiste.

Les 28 violations restantes sont la dette de ce durcissement — à résorber par identifiant et par
contrat, `IdentityGate.authorize(userId)` en étant le modèle.

### Les couches DDD — [WARN]

| Règle                                    | Violations | Ce qu'elle interdit                                                                           |
| ---------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `domaine-pur`                            | 0          | Le domaine dépendant d'`application`, `infrastructure` ou `presentation`.                     |
| `application-sans-infra-ni-presentation` | **1**      | L'application dépendant d'`infrastructure` ou `presentation`.                                 |
| `presentation-sans-modeles-ni-infra`     | **23**     | La présentation atteignant `domain/models` ou `infrastructure` sans passer par `application`. |

`application-sans-infra-ni-presentation` porte une **exemption étroite** : un DTO applicatif peut
importer _en type seul_ le validator Vine dont il dérive la forme du payload
(`Infer<typeof validator>`). Le schéma Vine est la source de vérité du contrat HTTP, et le couplage
reste sans effet à l'exécution. Toute autre dépendance vers `presentation/` ou `infrastructure/`
reste interdite.

Les 23 violations de `presentation-sans-modeles-ni-infra` sont le premier gisement du dépôt : ce
sont des contrôleurs qui manipulent un modèle au lieu d'un DTO. Elles relèvent du même principe que
les règles 2 à 4 de ce document, appliqué à la frontière HTTP.

### L'atomicité — [WARN]

| Règle                               | Violations | Ce qu'elle interdit                                                     |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------- |
| `transaction-portee-par-le-service` | **14**     | un use case ou une présentation important `@adonisjs/lucid/services/db` |

L'atomicité appartient au service qui écrit, ou au repository. Ouvrir une transaction depuis
l'appelant grave une décision de persistance dans une couche qui ne devrait connaître que des
contrats — et le jour où le service passe derrière une API, la transaction ne traverse pas le
réseau.

Cette règle comble un angle mort : `produit-consomme-core-par-service` ne filtre que les imports
`#core/…`, alors que `db` vient du package Lucid. Un use case produit pouvait donc piloter une
transaction sans qu'aucun invariant ne le voie.

**Huit des quatorze relèvent du placement, non de l'atomicité.** Les fichiers d'initiation et de
règlement de `money_movement` sont injectés et appelés par `MoneyMovementEngineImpl`, et par lui
seul : aucune présentation ne les atteint. Ce sont les composants internes du service, rangés dans
`use_cases/`. Ils portent donc la transaction à bon droit — en tant que service, pas en tant
qu'appelant. Leur place serait `application/services/`.

Le chemin produit, lui, est déjà conforme : `initiate_transfer.use_case.ts` d'`aiglebusiness`
délègue à la façade et n'ouvre aucune transaction. C'est le modèle à suivre pour les six autres
violations — `create_organisation`, `create_role`, `update_role`, `execute_admin_refund`,
`get_device_transaction_summary` et `register` — où l'atomicité peut descendre dans le service qui
écrit.

Cette règle peut donc viser ERROR : il faut reclasser les huit composants du moteur et corriger les
six appelants. Aucun cas n'est irréductible.

### Les garde-fous généraux — [WARN], zéro violation

| Règle                 | Ce qu'elle interdit                                     |
| --------------------- | ------------------------------------------------------- |
| `shared-sans-couches` | `app/shared/` dépendant d'une feature, core ou produit. |
| `no-circular`         | Toute dépendance circulaire.                            |

## Comment lire la sévérité

**ERROR** signifie « acquis » : la règle est à zéro violation et la commande échoue si elle repasse
au-dessus. **WARN** signifie « cap fixé, dette en cours » — la règle décrit où l'on va, pas où l'on
est.

Une règle passe de WARN à ERROR **quand sa dette atteint zéro**, jamais avant : poser une ERROR sur
un gisement de vingt violations condamne la commande, et poser une WARN de plus sur un bruit qu'on
ignore déjà n'apprend rien à personne. C'est la raison pour laquelle la garde intra-contexte
(ci-dessous) n'est pas encore écrite.

---

## Ce qui n'est pas concerné

- **Les repositories** manipulent et renvoient des modèles : c'est leur rôle, ils sont la couche de
  persistance. La règle 2 s'arrête à leur frontière.
- **À l'intérieur d'un service**, un modèle reçu d'un repository circule librement entre méthodes
  privées ; il est projeté au moment d'être rendu.
- **Les use cases** consomment services et repositories selon le même principe.

---

## Ce qui est différé

**Les frontières entre features d'un même contexte.** Aujourd'hui `money/transfer` peut consommer
`money/wallet` directement, et les `domain/models` valent domaine partagé — les relations Lucid
inter-features (FK, preloads, atomicité) en dépendent. Une mesure au 2026-08-03 relève **103
dépendances** de ce type, dont 86 hors relations entre modèles.

Ce découpage viendra avec la bascule en DDD strict, en deux temps :

1. séparer les modèles par feature, en remplaçant les relations inter-features par des identifiants
   et des contrats ;
2. poser la garde intra-contexte dans dependency-cruiser — le pendant de
   `produit-consomme-core-par-service` pour `app/core/{contexte}/{feature}/`.

Poser la garde avant le découpage produirait 103 avertissements qu'on apprendrait à ignorer. Elle
n'a de valeur qu'une fois la dette résorbée, comme l'ont été les invariants passés à ERROR.

---

## Migration

- **Nouveau code** : applique ces règles immédiatement.
- **Code existant** : aligner un service quand on le touche. Changer la signature d'un service très
  appelé se fait dans son propre changement, pas au détour d'une feature.
- Les `Result` déjà en place qui encapsulent un modèle (règle 4) sont de la dette connue : les
  aplatir quand la feature est rouverte.
