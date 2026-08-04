# Une base de test dédiée — la suite cesse de tourner sur les données réelles

**Date** : 2026-08-04
**Statut** : à approuver
**Portée** : `bin/test.ts`, `tests/bootstrap.ts`, `config/database.ts`, `database/seeders/`
**Remarque d'origine** : R11 (🔴 critique)

---

## Contexte

`config/database.ts` définit une seule connexion `mysql`, alimentée par `.env`. `bin/test.ts` pose
`NODE_ENV = 'test'` avant l'ignition, mais aucun `.env.test` n'existe : la variable ne change donc
pas la base. La suite s'exécute sur `aiglesend` @ `127.0.0.1:3307`.

Ce que contient cette base :

| users | transactions | wallets | ledgers | permissions | organisations |
| ----- | ------------ | ------- | ------- | ----------- | ------------- |
| 657   | 1 671        | 660     | 868     | 91          | 3             |

Dix-sept cas de test appellent `Permission.query().delete()` sur ces 91 lignes
(`permissions_sync.spec.ts`, `permissions_check.spec.ts`), un autre vide `FundingSettings`, et
quarante-neuf fichiers posent `SET FOREIGN_KEY_CHECKS = 0`. Seul `db.beginGlobalTransaction()`
restitue les données.

Ça tient. Ça a tenu des dizaines de fois. Mais la marge tient à un `ROLLBACK` : un processus tué
entre le `delete` et le rollback, une connexion coupée, un `--watch` interrompu, et la table du
contrôle d'accès part avec 657 comptes qui en dépendent.

---

## T-D1 — La suite ne choisit pas sa base, elle refuse de démarrer sur la mauvaise

Un `.env.test` correct protège tant qu'il est là. Absent, périmé, oublié dans un `git clone`, mal
copié depuis `.env.example` — et la suite repart en silence sur les données réelles, exactement comme
aujourd'hui. Une protection dont l'échec est silencieux n'en est pas une.

Le garde-fou est donc l'élément central, pas le fichier : `tests/bootstrap.ts` compare la base
effectivement connectée au nom attendu pour les tests et **interrompt la suite** si ça ne correspond
pas. Un `.env.test` manquant devient un arrêt franc et lisible, jamais une exécution destructrice.

C'est aussi ce qui rend le partage du serveur MySQL acceptable : ce n'est pas l'isolation physique
qui protège, c'est le refus de démarrer.

---

## T-D2 — Le fichier de test est chargé dans `process.env`, pas laissé à la précédence des fichiers

Le chargeur d'AdonisJS lit bien `.env.test` quand `NODE_ENV=test`, et saute délibérément `.env.local`
dans ce cas. Mais il traite les fichiers par `Promise.all`, en « premier écrivain gagne » :

```js
Object.keys(values).forEach((key) => {
  let value = process.env[key]
  if (value === undefined) {
    value = values[key]
    process.env[key] = values[key]
  }
})
```

`.env.test` précède `.env` dans le tableau, mais chaque fichier attend son parsing avant d'écrire :
l'ordre d'arrivée dépend de la résolution des promesses, pas de l'ordre du tableau. En pratique ça
tombe presque toujours juste. « Presque toujours » ne suffit pas pour arbitrer quelle base une suite
destructrice va viser.

Le même extrait montre le mécanisme déterministe : `process.env` est lu en premier et l'emporte sur
tous les fichiers. `bin/test.ts` charge donc `.env.test` dans `process.env` avant l'ignition. Plus
aucune dépendance à une subtilité du chargeur.

---

## T-D3 — Un schéma dédié sur le serveur existant

`aiglesend_test` sur le MySQL déjà en place. Pas d'infrastructure à monter, et la protection ne
repose de toute façon pas sur l'isolation physique mais sur le garde-fou de T-D1.

SQLite en mémoire a été écarté : le code émet du SQL MySQL explicite — `SET FOREIGN_KEY_CHECKS`,
`rawQuery` — et une suite qui valide un autre dialecte que celui de production ne valide plus grand
chose.

---

## T-D4 — Le schéma suit le code, sans geste manuel

`runnerHooks.setup` — aujourd'hui `[]` — lance les migrations sur la base de test au démarrage de la
suite. Une migration ajoutée est prise en compte à l'exécution suivante, sans rien à se rappeler.

C'est la seule entorse assumée à la règle « les migrations sont lancées par l'utilisateur » : elle
protège la base réelle, or il s'agit ici d'un schéma jetable que la suite possède entièrement. La
règle continue de valoir partout ailleurs.

---

## T-D5 — Les référentiels sont seedés, les cas sont posés par les tests

Bonne surprise : **les neuf seeders existent déjà** — `service_types`, `service_provider_methods`,
`providers`, `payment_methods`, `kyc_level`, `role_permission`, `funding_settings`,
`company_contact`, `user`. Rien à écrire, seulement à ordonner et à choisir.

Mesure du besoin réel : **dix fichiers de test** lisent des référentiels qu'ils n'ont pas créés —
les cinq flux de paiement, `account_standing_flow`, `account_sync_flow`,
`reconcile_pending_external`, et deux unitaires money. Les `firstOrFail` des autres suites portent
sur des `Transaction`, `Payment`, `OrganisationMember` que les tests créent eux-mêmes : ils ne
dépendent de rien.

Le partage est donc net. Ce qui est **référentiel** — types de service, tarifications, providers,
moyens de paiement, paliers, permissions — est seedé une fois au démarrage. Ce qui est **cas
métier** — users, wallets, transactions, organisations — reste créé par le test qui s'en sert, et
disparaît au rollback. `user_seeder` relève de la seconde catégorie : hors du seeding de test.

---

## T-D6 — L'ordre des seeders devient explicite

Mauvaise surprise, et c'est un défaut réel indépendamment de ce chantier :
`service_provider_methods_seeder` résout ses lignes par `ServiceType.findBy('code', …)`, donc dépend
de `service_types_seeder`. Or `db:seed` exécute en ordre naturel de nom de fichier, et
`service_provider_methods` **précède** `service_types`. Les `findBy` rendent `null`.

Aucun seeder ne déclare `static environment` non plus — aucun n'est restreint à un environnement.

L'ordre doit donc être déclaré, pas déduit d'un tri alphabétique. Le seeding de test appelle une
liste explicite, dépendances d'abord. Le renommage en préfixes numérotés est écarté : il encode
l'ordre dans le nom de fichier, où rien ne signale pourquoi.

---

## T-D7 — Ce qui reste hors périmètre

Les dix-sept `Permission.query().delete()` et les quarante-neuf `SET FOREIGN_KEY_CHECKS = 0` **ne
sont pas corrigés ici**. Sur un schéma jetable ils deviennent inoffensifs, et c'était bien leur
dangerosité — non leur existence — qui motivait R11.

`SET FOREIGN_KEY_CHECKS = 0` masque en revanche de vraies violations d'intégrité référentielle dans
les jeux d'essai. C'est une remarque à part, à ouvrir au backlog une fois ce chantier passé.

---

## Ce qui est déjà en place

- `bin/test.ts` pose `NODE_ENV = 'test'` **avant** l'import de `#start/env` — l'ordre nécessaire est
  déjà bon, il ne manque que le fichier et le garde-fou.
- Le chargeur d'env saute `.env.local` quand `NODE_ENV` vaut `test` : aucune fuite de surcharge
  locale dans la suite.
- Les neuf seeders de référentiels.
- `tests/bootstrap.ts` expose `runnerHooks.setup`, prêt à recevoir migrations et seeding.

---

## Découpage

| Lot    | Contenu                                                                    | Dépend de |
| ------ | -------------------------------------------------------------------------- | --------- |
| **T1** | `.env.test`, chargement déterministe, garde-fou, base `aiglesend_test` migrée | —         |
| **T2** | Seeding des référentiels au démarrage, ordre déclaré explicitement          | T1        |
| **T3** | Réparation des suites qui tombent sur un schéma propre                      | T2        |

T1 est livrable seul et rend déjà la base réelle inatteignable — c'est lui qui referme R11. T2 et T3
rendent la suite verte ; T3 seul a un volume inconnu tant que T1 et T2 ne sont pas passés.

---

## Ce qu'on saura à la fin

La suite ne pourra plus atteindre les données réelles, et ne le pourra plus par construction : elle
refusera de démarrer plutôt que de viser la mauvaise base.

On saura aussi ce que la suite vaut réellement. Aujourd'hui, 550 tests passent sur une base peuplée
de 657 comptes et 1 671 transactions : impossible de distinguer un test qui pose son contexte d'un
test qui s'appuie sur une ligne qu'un autre a laissée. Sur un schéma propre, ce qui reste vert est
vert pour de bon.

Le compte des cinq échecs préexistants — Kyc ×2, ProviderErrorService, DeviceService — sera à relire
dans ce cadre : certains tiennent peut-être à des données absentes plutôt qu'à un défaut de code.
