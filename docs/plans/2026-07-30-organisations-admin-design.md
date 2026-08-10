# Gestion des organisations dans l'espace admin — Design

**Date** : 2026-07-30
**Statut** : livré — O1 à O4

---

## Contexte

L'espace admin affichait les organisations depuis un mock intégral (`organisations.mock.ts`, dix
méthodes de service). Côté API, **aucune route admin** n'existait pour les organisations : seuls des
chemins client, rattachés à un propriétaire.

Conséquence pratique : impossible de naviguer vers une organisation réelle, donc impossible de
tester sur de vraies données ce qui s'y branche — à commencer par l'onglet paiement en masse livré
avec le lot M3.

L'essentiel du travail de données existait déjà : `OrganisationMemberRepository`,
`WalletRepository.findByAccountIds`, `TransactionRepository.listByAccount`. Ce qui manquait était la
couche de présentation admin, plus la pagination, la recherche et le comptage groupé de membres.

---

## Décisions

### O-D1 — Le propriétaire, le portefeuille et le nombre de membres sont résolus par lot

| Option écartée | Pourquoi |
|---|---|
| Déclarer des relations ORM entre `organisations` et les tables core (`users`, `wallets`) | Les tables produit ne déclarent pas de relation vers le core : c'est ce qui garde la feature extractible. Une relation ici rendrait le module organisation inséparable du core identité et du core monnaie. |
| Résoudre par ligne, à l'affichage | Une page de dix organisations coûterait trente requêtes, cent sur un `perPage` élevé. |

`OrganisationEnrichmentService.resolve()` prend la page entière et rend trois tables indexées, en
trois requêtes quel que soit le nombre de lignes. Même patron que le résolveur d'acteurs du paiement
en masse.

### O-D2 — `perPage` est plafonné à 100 côté serveur

Le validateur borne déjà l'entrée, mais le plafond est **aussi** appliqué dans le use case : un
appelant interne qui construirait la requête sans passer par le contrôleur balaierait sinon la table
entière. Un test le verrouille.

### O-D3 — La recherche d'autocomplétion refuse un terme vide

Sans cette garde, un champ que l'utilisateur vide déclenche une requête qui rend toute la table. Le
refus est porté à trois niveaux : validateur (`minLength(1)`), repository (retour `[]` sur terme
blanc), et service front (pas d'aller-retour du tout).

### O-D4 — La borne haute de date couvre la journée entière

`endDate` reçoit une date sans heure. Comparée telle quelle, elle exclut toute la journée
sélectionnée. Le repository la porte à `23:59:59`.

---

## Découpage

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| **O1** | Liste paginée + filtres, recherche, fiche · permission `organisations.read` · OpenAPI · front débranché sur ces trois appels | — | livré |
| **O2** | Sous-ressources de la fiche : membres, portefeuille, transactions | O1 | livré |
| **O3** | Blocage / déblocage + gel du portefeuille + compteurs d'en-tête · permissions `organisations.block` et `organisations.wallets.freeze` | O1 | livré |
| **O4** | Onglets historiques : grand livre et réapprovisionnement, comme sur la fiche utilisateur | O2 | livré |

**Hors périmètre** : l'onglet KYB, rattaché au chantier KYB déjà différé.

### O-D5 — L'activité d'un compte est agrégée depuis le grand livre, pas depuis les transactions

Une somme calculée sur les transactions compterait aussi celles qui n'ont jamais abouti. Le grand
livre ne contient que les mouvements réellement écrits, il est donc la seule source qui puisse
prétendre à un total. `LedgerService.getAccountActivity(accountId)` résout le portefeuille en interne :
l'appelant n'a à connaître ni le portefeuille du compte ni le grand livre.

Une organisation sans portefeuille rend des compteurs à zéro plutôt qu'une erreur — elle existe, elle
n'a simplement rien à montrer. En revanche, une organisation **inconnue** lève 404 : une liste vide
laisserait croire à une organisation réelle sans membre.

### O-D6 — Les onglets d'historique filtrent les routes admin existantes, sans route dédiée

Trois onglets d'historique, trois filtres ajoutés à des routes qui existaient déjà :

| Onglet | Route | Filtre ajouté |
|---|---|---|
| Transactions | `GET /api/admin/transactions` | `accountId` |
| Grand livre | `GET /api/admin/ledgers` | `accountId` |
| Réapprovisionnement | `GET /api/admin/funding-requests` | `organisationId` |
| Paiement en masse | `GET /api/admin/mass-transfers` | `organisationId` (livré avec M3) |

Créer `GET /admin/organisations/:id/transactions` et ses semblables aurait dupliqué quatre DTOs admin
et leurs résolutions d'acteurs, pour un résultat identique.

Côté grand livre, le filtre passe par un scope `filterByAccount` — pendant de `filterByUser` pour les
comptes non personnels, une organisation n'ayant pas de `userId`. Il est écrit en sous-requête plutôt
qu'en `whereHas` : la relation `wallet` n'est pas typée pour `whereHas`, et l'employer aurait ajouté
deux erreurs de compilation au décompte.

L'onglet grand livre ne reprend pas les compteurs d'activité, déjà présents en tête de fiche : les
répéter donnerait deux endroits à lire pour un même chiffre.

### O-D7 — Les encaissements se comptent séparément des écritures

La carte « Encaissements » affichait `transactionCount`, c'est-à-dire le `COUNT(*)` de **toutes** les
écritures, débits compris, sous un montant qui ne portait que sur les crédits. Le chiffre et le
montant ne parlaient pas de la même chose.

L'agrégat porte désormais `inCount` et `outCount` en plus du total. Et le libellé « Transactions » de
l'onglet portefeuille devient « Écritures comptables » : une transaction produit plusieurs lignes au
grand livre — débit, crédit, frais.

### Ce qui reste mocké après O3

Une seule méthode de `organisations.service.ts` : `getOrganisationKyb`, rattachée au chantier KYB.
Les trois autres — compteurs, blocage, activation — sont branchées sur leurs endpoints.

### O-D8 — Bloquer coupe l'accès et gèle l'argent ; débloquer ne rend que l'accès

La question laissée ouverte — bloquer empêche-t-il de se connecter, d'encaisser ou de décaisser ? —
se tranche en observant qu'un blocage qui ne couperait que l'accès ne protège rien : les
encaissements par QR continueraient de créditer et un lot de paiement approuvé continuerait de se
vider, sans que **personne dans l'organisation ne puisse plus intervenir** puisque l'accès est coupé.
Le blocage produit donc les deux effets d'un seul geste.

Le retour est volontairement **asymétrique** : débloquer rouvre l'accès mais **ne dégèle pas** le
portefeuille, qui demande une action explicite. Rendre l'accès est réversible et sans conséquence ;
rendre l'argent ne l'est pas. Un administrateur qui rouvre une organisation pour qu'elle réponde à
une demande de justificatifs ne remet pas les mouvements en marche par le même clic.

Les deux droits sont distincts : `organisations.block` porte le blocage — et donc le gel qu'il
entraîne, sa description le dit — tandis que `organisations.wallets.freeze` couvre le gel et le
dégel exercés seuls. Le dégel n'est ainsi jamais accessible à qui ne détient que le blocage.

### O-D9 — La garde d'accès vit sur le groupe de routes, pas dans le helper de permission

L'endroit évident pour refuser une organisation bloquée serait `memberHasPermission` : tout y passe,
et la vérification y est déjà **live** — elle interroge la base à chaque requête, jamais le jeton, si
bien qu'un changement prend effet immédiatement sans re-login. C'est la propriété qui rend la
révocation possible.

Mais ce helper n'est atteint que par le middleware `orgPermission`, et celui-ci ne garde que **14
des ~40 routes** scopées organisation : `business_routes.ts`, le catalogue et les appareils n'en ont
aucune. Y placer la garde laisserait donc le blocage percé, sans que rien ne le signale.

La garde est donc un middleware distinct, `activeOrganisation`, posé sur les groupes de routes —
c'est le raisonnement de
l'[ADR-0016](../../../../docs/2026-08-01-adr-016-controle-acces-exprime-sur-la-route.md) appliqué au
chemin client : la garde se lit là où la route se déclare.

Il n'existe cependant **pas un** groupe `organisations/:organisationId` mais **sept**, éclatés entre
membership, funding, transactions, transfer et paiement en masse, chacun réécrivant le chemin en
dur. La garde doit donc être posée sept fois, et un module futur pourrait l'oublier.

Un middleware global sur `router.use()` supprimerait cet oubli, mais s'exécuterait **avant** `auth` :
une organisation bloquée répondrait `403` à un appelant non authentifié, révélant son existence à qui
en devine l'identifiant. Le risque d'oubli est préféré à cette fuite, et fermé autrement — par un
**test qui parcourt la table de routage** et vérifie que toute route portant `:organisationId` porte
la garde. C'est le filet du chantier RBAC, transposé : la dispersion devient tenable parce qu'elle
est vérifiée à chaque exécution des tests.

### O-D10 — Les jetons business des membres sont révoqués, et eux seuls

Le jeton porte `app:aiglebusiness` ou `app:aiglesend` : ce sont **deux jetons distincts**. Révoquer
les jetons business d'un membre ne touche donc pas son compte personnel AigleSend — ce qui rend la
révocation transposable depuis `ChangeUserStateUseCase`, où bloquer un utilisateur supprime ses
jetons.

Le jeton ne descend en revanche **pas** jusqu'à l'organisation : elle vient de l'URL, résolue à
chaque requête. Un membre de plusieurs entreprises n'a donc qu'un seul jeton business, et sa
révocation le déconnecte de toutes. C'est accepté : le coût est une reconnexion, sur un événement
rare, et il ne pouvait de toute façon plus atteindre l'organisation bloquée.

La révocation ne porte pas la protection — c'est la garde de O-D9 qui la porte. Elle vient en
défense en profondeur : si une route échappait au groupe gardé, la session morte la couvre encore.

### O-D11 — Le relais de transferts revérifie le statut avant chaque ligne

Approuver un lot le met en `QUEUED` et laisse un job asynchrone le décaisser. Or
`app/core/money/transfer/application/` ne contient **aucune** vérification de statut : les fonds ont
été mis en hold à la création, et le relais les verse sans rien revérifier. Le trou est donc
antérieur au blocage — il existe aujourd'hui, gel ou pas.

Le traitement d'une ligne vérifie désormais le compte et le portefeuille avant de la verser. Un lot
en cours s'interrompt au gel, les lignes restantes sont suspendues et le hold conservé — l'argent
n'est ni versé ni rendu tant que la situation n'est pas arbitrée.

La suspension est réservée aux **deux états réversibles** — compte bloqué, portefeuille gelé. Toute
autre erreur suit le traitement d'échec ordinaire, qui finit par rendre la part au client. Un
premier jet attrapait toutes les exceptions : il transformait n'importe quelle panne, et jusqu'à un
bug d'appel, en attente silencieuse d'un lot d'argent. C'est un test qui l'a révélé.

La garde lit le **statut seul** du compte, par `getStatus`, et non son standing complet : résoudre
les limites ferait dépendre le versement d'un lot déjà engagé de la configuration du catalogue de
niveaux, sans rapport avec le gel.

C'est la seule partie du lot qui touche au core plutôt qu'au produit, et la seule qui corrige un
comportement existant au lieu d'en ajouter un.

### O-D12 — Une organisation bloquée est `INACTIVE`, sans troisième état

`OrganisationStatus` porte déjà `ACTIVE` et `INACTIVE`, et `INACTIVE` n'est **jamais écrit** : seule
la création affecte le statut. Le blocage sera donc le seul chemin vers cet état, et lui ajouter un
`BLOCKED` distinct laisserait `INACTIVE` mort à côté.

La colonne est une `string`, pas une énumération SQL : aucune migration n'est requise, et le front
— qui compte déjà les `inactiveOrganisations` et filtre par statut — n'a rien à changer. Si une
fermeture à l'initiative du propriétaire apparaît un jour, elle prendra son propre état.

### O-D13 — Un membre bloqué reçoit une exception métier, pas un 403 nu

La garde lève `OrganisationBlockedException` (`E_ORGANISATION_BLOCKED`), que le mobile reconnaît
pour afficher un écran dédié renvoyant vers le support. Un 403 générique laisserait un membre
légitime sans explication ni recours devant une organisation qui a simplement disparu de sa liste.

C'est le même principe que le message du chemin client : couper un accès sans nommer le recours
transforme une décision réversible en impasse.

---

## Découpage de O3

| Sous-lot | Contenu | Dépend de |
|-----|---------|-----------|
| **O3a** | Compteurs d'en-tête : `GET /organisations/stats`, six champs déjà contractés par le front | — |
| **O3b** | Blocage / déblocage : statut, middleware de groupe, exception, révocation des jetons | — |
| **O3c** | Gel / dégel du portefeuille, entraîné par O3b, et revérification du relais (O-D11) | O3b |
| **O3d** | Front : débranchement des trois mocks et écrans d'action | O3a, O3b, O3c |

---

## Action requise

```
node ace db:seed --files="database/seeders/organisation_permission_seeder.ts"
```

Sans ce seed, `organisations.read` n'existe pas et toutes les routes rendent 403.
