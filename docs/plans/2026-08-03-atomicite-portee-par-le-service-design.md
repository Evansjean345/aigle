# L'atomicité appartient au service — résorption de la dette

**Date** : 2026-08-03
**Statut** : livré — A1, A2 et A3
**Portée** : les 14 violations de `transaction-portee-par-le-service`

---

## Contexte

La règle `transaction-portee-par-le-service` refuse qu'un use case ou une présentation importe
`@adonisjs/lucid/services/db`. Elle comble un angle mort : `produit-consomme-core-par-service` ne
filtre que les imports `#core/…`, alors que `db` vient du package Lucid — un use case pouvait donc
piloter une transaction sans qu'aucun invariant ne le voie.

Le modèle existe déjà dans le dépôt. `initiate_transfer.use_case.ts` d'aiglebusiness construit une
`Command` et appelle un **port de domaine** (`MoneyMovementEngine`). Il n'ouvre rien et ne connaît
aucun service concret ; l'orchestration, l'atomicité, les écritures et les événements vivent
derrière le port.

L'examen des quatorze violations montre qu'elles recouvrent **trois problèmes différents**, que la
règle confondait.

---

## A-D1 — Les huit unités du moteur sont des services, pas des use cases

`money_movement` range sous `application/use_cases/initiation|settlement/` huit fichiers injectés et
appelés par `MoneyMovementEngineImpl`, et par lui seul. Aucune présentation ne les atteint.

Le découpage est délibéré — la façade le documente : « chaque flux testable isolément ». Ce n'est
pas le découpage qui pose problème, c'est le **nom**. Partout ailleurs dans le dépôt, un use case
est ce qu'un contrôleur appelle ; ici, c'est ce qu'un service appelle.

Ils deviennent `application/services/movements/`, et prennent le nom de ce qu'ils sont :
`ExternalInHandler`, `SettleDepositHandler`. Tous exposent `handle()`, et la convention existe déjà
dans le dépôt (`transaction_failure_handler.ts`). Le découpage par flux est conservé, la façade
reste légère, et l'atomicité qu'ils portent devient légitime : un service porte sa transaction.

Déplacer sans renommer aurait laissé le problème que cette décision identifie — des fichiers
`*.use_case.ts` dans un dossier de services.

**L'alternative écartée** : exempter `money_movement` dans la règle. Elle masquerait huit fichiers
durablement et laisserait la nomenclature incohérente, pour ne rien changer d'autre.

---

## A-D2 — Le SQL brut sort du use case

`get_device_transaction_summary` n'ouvre pas de transaction : il exécute **trois `db.rawQuery()`**.
C'est un problème de repository manquant, attrapé par effet de bord.

Les trois requêtes deviennent des méthodes de repository. C'est la règle 1 des
[frontières de service](../rules/2026-08-03-service-boundary-rules.md) appliquée à un use case.

---

## A-D3 — Les transactions inter-frontières restent, et sont nommées

Trois use cases ouvrent une transaction qui englobe des collaborateurs de **features différentes** :

| Use case               | Ce que la transaction englobe                                                                                    | Frontières |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| `create_organisation`  | `accountService` (core/identity), `payableAliasService` (core/qr), `organisationRepository`, `membershipService` | 3          |
| `register`             | `userRepository` (core/identity), `accountService` (core/identity/account)                                       | 2          |
| `execute_admin_refund` | `transactionService`, `walletService`, `refundService`                                                           | 2          |

Aucun service ne peut porter seul cette atomicité : elle coordonne précisément ce que le découpage
sépare. Les descendre d'un cran déplacerait le problème sans le résoudre.

Ils **restent en l'état** et sont consignés ici comme les points où une saga sera nécessaire le jour
de l'extraction. La règle continue de les signaler : c'est ce qui garantit que la liste sera à jour
ce jour-là, plutôt que découverte au pire moment.

`create_organisation` mérite d'être noté : il est dans aiglebusiness, le produit qui sert de modèle
au reste. Le modèle vaut pour le transfert, pas pour la création d'organisation.

---

## A-D4 — Les cas mono-collaborateur descendent

`create_role` et `update_role` enchaînent deux appels au **même** repository — créer le rôle, y
attacher ses permissions. L'atomicité descend dans le repository, qui expose l'opération complète.

Rien n'est coordonné entre features : c'est le cas simple, et il n'y a pas de raison de le laisser.

---

## Découpage

| Lot    | Contenu                                                                  | Violations levées |
| ------ | ------------------------------------------------------------------------ | ----------------- |
| **A1** | Reclasser les huit unités du moteur en `application/services/movements/` | 8                 |
| **A2** | Sortir les trois `rawQuery` de `get_device_transaction_summary`          | 1                 |
| **A3** | Descendre l'atomicité de `create_role` et `update_role`                  | 2                 |

Reste 3 violations après A3 — celles d'A-D3, assumées et documentées.

---

## Ce qu'on saura à la fin

La règle passe de 14 à 3 violations, toutes nommées et justifiées. Elle ne pourra pas atteindre zéro
sans une décision d'architecture sur les sagas — et c'est précisément ce qu'elle doit continuer de
rappeler.
