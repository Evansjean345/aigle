# Tests — Rules

**Date** : 2026-08-18
**Statut** : Validé
**Scope** : tout `*.spec.ts` de `tests/`, plus `tests/fakes/` et `tests/factories/`
**Référence** : [documentation officielle Japa](https://japa.dev/docs/introduction) — les mécanismes
du runner (hooks, datasets, exceptions, suites, plugin assert) suivent ce qu'elle prescrit. Les
écarts sont nommés et justifiés dans [ce que prescrit la documentation officielle](#ce-que-prescrit-la-documentation-officielle).

---

## Principe fondateur

> Un test décrit **un comportement observable** par l'interface publique de sa cible. Ce qu'il
> substitue à une dépendance en **respecte le contrat en entier**, vérifié par le compilateur.

Les deux moitiés comptent, et la seconde est celle qui laisse passer des bugs.

Une doublure partielle — un objet littéral qui porte trois méthodes sur douze, passé avec un cast —
n'est pas une simplification : c'est un contrat éteint. Le compilateur ne compare plus rien. Le jour
où la cible appelle une méthode que la doublure n'a pas, le test continue de passer tant que ce
chemin n'est pas exercé, et casse en production. Le jour où le contrat gagne un paramètre, aucune
doublure ne le signale.

Le test à s'appliquer : **si j'ajoute une méthode au contrat, est-ce que quelque chose casse ?** Si
la réponse est non, la doublure ne double rien.

---

## Règle 1 — Une doublure implémente le contrat, sans cast

Le cast est l'interdit central. `as unknown as`, `as never`, `as any` sur une dépendance :

```ts
// ❌ le compilateur ne vérifie plus rien
const cache = {
  incrementOnSuccess: async (p) => calls.push(p),
} as unknown as TransactionVolumeCache

// ✅ le contrat est tenu, et le reste
export default class InMemoryTransactionVolumeCache implements TransactionVolumeCache {
  async incrementOnSuccess(params: { accountId: string; amount: number }): Promise<void> { … }
  async getDailyVolume(accountId: string): Promise<number> { … }
  async getMonthlyVolume(accountId: string | number): Promise<number> { … }
  async getMonthlyVolumesForAccounts(accountIds: string[]): Promise<Record<string, number>> { … }
  async clearVolume(accountId: string): Promise<void> { … }
}
```

Toutes les méthodes sont là. Celles que le test n'exerce pas rendent une valeur neutre — ce n'est
pas du remplissage, c'est ce qui fait que le contrat reste comparé.

`implements`, pas `extends` : la doublure n'hérite de rien, elle déclare qu'elle satisfait le
contrat.

**Une doublure qui ne peut pas implémenter son contrat est un signal, pas une exception.** Si la
dépendance est une classe concrète (`NotificationService`, `FileStorageService`), il n'y a pas de
port à implémenter et le cast redevient inévitable. La bonne réponse est d'extraire le port. Tant
qu'il n'existe pas, la doublure vit quand même dans `tests/fakes/`, ne reproduit que la surface
appelée, et **le dit dans son en-tête** :

```ts
/**
 * Reproduit la seule méthode que les écouteurs appellent, sans déclarer `NotificationService`
 * implémentée : c'est une classe concrète, pas un port. Elle est passée avec un cast là où le
 * service est attendu.
 */
```

Le commentaire n'excuse pas le cast : il le rend comptable.

---

## Règle 2 — Une doublure vit dans `tests/fakes/`, jamais dans une spec

Un fichier, une classe, rangée par contexte : `tests/fakes/{contexte}/{nom}.ts`.

```
tests/fakes/
├── money/         in_memory_transaction_volume_cache.ts · in_memory_idempotency_provider.ts
├── risk/          in_memory_transaction_throttle_cache.ts · in_memory_transaction_failure_cache.ts
├── notifications/ capturing_notification_service.ts
├── identity/ · account/ · kyc/ · shared/
```

Une doublure déclarée dans une spec est invisible aux autres : la suivante la recopie. C'est ainsi
que la même capture de notifications a existé en deux exemplaires, et la même jambe d'événement en
trois.

Corollaire : **une doublure recopiée une seconde fois doit être extraite**, pas copiée une
troisième.

---

## Règle 3 — Deux noms, pas sept

| Préfixe      | Quand                                                            |
| ------------ | ---------------------------------------------------------------- |
| `InMemory…`  | La doublure **tient un état** et répond comme le vrai le ferait. |
| `Capturing…` | La doublure **retient les appels** pour que le test les lise.    |

`Fake`, `Stub`, `Spy`, `Mock`, `Silent`, `Permissive` disent la même chose en sept mots et
n'apprennent rien de plus au lecteur. Ce qui compte est ce que la doublure fait de ce qu'elle
reçoit : elle le garde, ou elle le note.

Ce qu'une doublure expose au test est une donnée publique en lecture, nommée par ce qu'elle
contient — `stamped`, `increments`, `calls` — jamais `getCalls()`.

---

## Règle 4 — On ne double que les frontières

Une frontière est ce qui sort du processus : réseau, base, Redis, opérateur, push, mail, stockage,
horloge.

Un **collaborateur interne** ne se double pas. Doubler le service qu'appelle le use case revient à
tester que le use case appelle ce qu'on a écrit qu'il appelle — le test devient une copie de
l'implémentation et casse à chaque refactor sans qu'aucun comportement n'ait bougé.

```ts
// ❌ frontière interne doublée : le test décrit le câblage
const walletService = new CapturingWalletService()

// ✅ la frontière réelle est doublée, le vrai service travaille
const listener = new ResetSecurityCountersOnSuccess(
  new InMemoryTransactionThrottleCache(),
  new InMemoryTransactionFailureCache()
)
```

Quand un fake officiel du framework existe pour la frontière (`mail.fake()`, `emitter.fake()`,
`drive.fake()`), il passe avant une doublure maison, et il est restauré en teardown.

---

## Règle 5 — Les données passent par une fabrique

Aucun objet de test recopié d'une spec à l'autre. `tests/factories/{sujet}_factory.ts` :

```ts
export function walletToWalletLeg(overrides: Partial<WalletToWalletLeg> = {}): WalletToWalletLeg
export function merchantPaymentCompleted(params: { recipientAccountId: string; … })
```

Deux niveaux, et l'ordre compte :

1. une fabrique **primitive** qui rend l'objet complet, tous champs à une valeur neutre, avec des
   `overrides` ;
2. des fabriques **nommées par le cas métier** (`merchantPaymentCompleted`, `p2pTransferCompleted`)
   construites sur la première.

La seconde est ce qui rend les specs lisibles : le test dit « un paiement marchand », pas onze
champs dont neuf sans intérêt pour lui. Un test ne fixe que les champs dont dépend son assertion —
tout champ fixé est une affirmation implicite qu'il compte.

---

## Règle 6 — La suite est choisie par ce qu'on exerce, pas par facilité

| Cible                                                   | Suite        | Budget |
| ------------------------------------------------------- | ------------ | ------ |
| Logique métier pure, projection, calcul, mapping        | `unit`       | 2 s    |
| Service ou écouteur, ses frontières doublées            | `unit`       | 2 s    |
| Requête Lucid réelle, repository                        | `functional` | 30 s   |
| Contrôleur, route, middleware, validation, autorisation | `functional` | 30 s   |

**Un test unitaire ne touche jamais la base.** C'est tenu aujourd'hui — zéro spec de `tests/unit/`
n'importe `db` ni ne requête un modèle — et le budget de 2 s déclaré dans `adonisrc.ts` en dépend.
Un test unitaire qui a besoin de la base teste autre chose que ce qu'il croit.

L'inverse est un travers plus courant : tout pousser en HTTP parce que c'est le chemin qu'on connaît.
Un écouteur, un service de calcul, une projection se testent en unitaire — plus précis, cinquante
fois plus rapide, et l'échec désigne la cause au lieu de la couche.

Emplacement : `tests/{suite}/{contexte}/{sujet}.spec.ts`, le contexte reflétant celui d'`app/`.

---

## Règle 7 — L'isolation est portée par le framework

```ts
// ✅
group.each.setup(() => testUtils.db().withGlobalTransaction())
```

L'état créé par un `setup` se défait par la **fonction de nettoyage qu'il retourne**, pas par un
`teardown` séparé. C'est la recommandation explicite de la documentation Japa, et pour une raison
qu'un `teardown` n'a pas : si le `setup` échoue, sa fonction de nettoyage n'est pas exécutée — on
n'essaie jamais de défaire un état qui n'a pas été créé.

```ts
group.each.setup(async () => {
  await createTables()
  return async () => await dropTables()
})
```

Le dépôt applique déjà cette forme partout. Ce qui pèche est en dessous : `db.beginGlobalTransaction()`
appelé à la main fait ce que `testUtils.db().withGlobalTransaction()` fait en une ligne, recopié 66
fois.

**Un hook identique dans plus de deux specs appartient à la suite, pas aux specs.** Japa permet de
l'enregistrer une fois dans `configureSuite` (`tests/bootstrap.ts`), où le serveur HTTP de la suite
fonctionnelle est déjà démarré :

```ts
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (suite.name === 'unit') return

  suite.setup(() => testUtils.httpServer().start())
  suite.onTest((test) => test.setup(() => testUtils.db().withGlobalTransaction()))
}
```

C'est la réponse de fond aux 66 copies : une spec n'a plus de hook d'isolation du tout, sauf à en
vouloir un autre.

**Désactiver les contraintes de clé étrangère est interdit dans un nouveau test.**

```ts
// ❌ le test ne peut plus voir une écriture orpheline
await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
```

C'est la ligne qui coûte le plus cher de tout ce document. Elle est là parce que les données de test
sont incomplètes — un portefeuille créé sans son porteur — et elle éteint précisément la vérification
qui attraperait un code écrivant une référence vers rien. Un test qui en a besoin doit compléter ses
données par une fabrique, pas taire la base.

Quand le code sous test ouvre et valide ses propres transactions (`forUpdate`, règlement de webhook),
le rollback ne suffit pas : `testUtils.db().truncate()`, et la raison en commentaire dans le `setup`.

Une spec fonctionnelle qui **n'écrit pas** — toutes ses frontières doublées, ou lecture seule — n'a
pas besoin de hook. C'est le cas de quinze d'entre elles aujourd'hui, et c'est légitime : l'isolation
répond à une écriture, pas à un emplacement dans l'arborescence.

---

## Règle 8 — Un comportement par test, nommé comme une spécification

Le nom énonce ce que le système fait, au présent, sans jargon d'implémentation :

```ts
// ❌ nomme la mécanique
test('handle() appelle setLastSuccessTime une fois', …)

// ✅ nomme le comportement
test('transfert p2p → seul l’émetteur est horodaté, le bénéficiaire reste libre', …)
```

Le nom du groupe porte la cible et l'angle : `'ResetSecurityCountersOnSuccess | qui est horodaté'`.

Arrange / Act / Assert, et **aucun `if` ni `for`** dans un test : deux cas dans un test sont deux
tests, ou un dataset.

Le dataset s'écrit `.with()` **avant** `.run()` — c'est cet ordre qui donne à TypeScript le type du
paramètre, et le titre interpole les champs entre accolades :

```ts
test('un compte {segment} plafonne à {limite} F CFA')
  .with([
    { segment: 'particulier', limite: 200_000 },
    { segment: 'organisation', limite: 2_000_000 },
  ])
  .run(({ assert }, { segment, limite }) => {
    assert.equal(limitOf(segment), limite)
  })
```

Chaque ligne devient un test nommé, qui échoue seul. Une boucle dans un test échoue en bloc et ne
dit pas laquelle des lignes a cassé.

L'en-tête de la spec dit en trois lignes **ce qui est caractérisé et pourquoi ça compte** — pas
l'historique du bug, pas la référence au registre (règle 3 des JSDoc), pas la liste des étapes.

---

## Règle 9 — Une assertion porte sur une valeur

`assert.equal`, `assert.deepEqual`, `assert.include`. `assert.isTrue` et `assert.isOk` ne disent que
« quelque chose est arrivé » : ils passent encore quand la valeur est fausse.

**Jamais de `try/catch` pour tester une erreur** — il passe à tort quand rien n'est levé :

```ts
// ❌ passe si le code ne lève pas
try {
  await service.transfer(cmd)
  assert.fail()
} catch (e) {
  assert.equal(e.code, 'E_THROTTLE')
}

// ✅
await assert.rejects(() => service.transfer(cmd), TransferThrottleException)
```

Japa en documente trois formes : `assert.throws` / `assert.rejects`, l'équivalent `expect`, et la
forme haute `test(…).throws(…)` posée sur le test lui-même. **Ce dépôt s'en tient à `assert`** — le
plugin `expect` n'est pas chargé dans `tests/bootstrap.ts`, et la forme haute déplace l'attente hors
du corps du test, là où elle se lit moins bien à côté d'assertions ordinaires. Un seul style dans
113 assertions d'erreur vaut mieux que trois.

Quand un test comporte un chemin conditionnel côté code sous test — une notification qui part ou ne
part pas — `assert.plan(n)` fige le nombre d'assertions attendues et fait échouer le test si l'une
d'elles a été sautée. C'est le garde-fou contre le test qui passe parce qu'il n'a rien vérifié.

**Argent** : montants entiers en XOF, comparés exactement. Un arrondi se teste explicitement, jamais
par tolérance.

Une assertion en base (`assert.assertExists`) constate un **effet observable**, elle ne reconstitue
pas la mécanique interne. Vérifier par une requête SQL ce que l'interface publique rend déjà couple
le test au schéma.

---

## Règle 10 — Une URL de test se construit par le helper

```ts
// ❌ 104 occurrences aujourd'hui : une route qui bouge casse cent tests
await client.post('/api/transactions/transfert')

// ✅
await client.post(route('transactions.transfert'))
```

Même principe pour l'authentification : `loginAs(user)`, jamais un jeton forgé à la main.

Tout endpoint couvre le chemin nominal **et** ce qui le protège : 422 de validation, 401/403
d'autorisation, 404, et l'effet persistant.

---

# Ce que prescrit la documentation officielle

Les mécanismes du runner viennent de [japa.dev](https://japa.dev/docs/introduction). Ce tableau dit
lesquels ces règles reprennent, et où elles vont plus loin — un choix de projet n'est légitime que
s'il est nommé.

| Prescription Japa                                                                                                    | Ici                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Fonction de nettoyage retournée par le `setup`](https://japa.dev/docs/lifecycle-hooks), jamais un `teardown` séparé | Règle 7 — déjà appliqué partout dans le dépôt                              |
| [Hooks au niveau de la suite](https://japa.dev/docs/test-suites#lifecycle-hooks) via `configureSuite`                | Règle 7 — sous-exploité : 66 hooks recopiés là où la suite en porterait un |
| [Datasets](https://japa.dev/docs/datasets) plutôt qu'une boucle, `.with()` avant `.run()`                            | Règle 8 — l'ordre est ce qui type le paramètre                             |
| [Trois formes d'assertion d'erreur](https://japa.dev/docs/exceptions) : `assert`, `expect`, forme haute              | Règle 9 — **écart assumé** : `assert` seul, `expect` n'est pas chargé      |
| [`assert.plan(n)`](https://japa.dev/docs/plugins/assert) contre le test qui ne vérifie rien                          | Règle 9 — sur les tests à chemin conditionnel                              |
| [Suites nommées avec leurs globs](https://japa.dev/docs/test-suites)                                                 | Règle 6 — `unit` et `functional`, budgets 2 s et 30 s                      |

Deux points que la documentation ne couvre pas, et qui sont donc des décisions de ce dépôt :

- **La forme des doublures** (règles 1 à 4). Japa ne prescrit rien sur le remplacement des
  dépendances — c'est le point où ces règles apportent le plus, et c'est aussi celui où le dépôt
  avait le plus dérivé.
- **Les fabriques de données** (règle 5). La documentation AdonisJS recommande les Model Factories
  Lucid ; le dépôt n'en a aucune et écrit à la main. L'écart est nommé dans « ce qui est différé ».

Le reste — `route()`, `loginAs()`, les assertions en base — relève d'AdonisJS et de son client API,
pas du runner.

---

# L'état mesuré — 2026-08-18

125 specs, deux suites (`unit` 2 s, `functional` 30 s), 883 tests au vert.

| Règle                 | Dette mesurée                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — pas de cast       | **208** casts dans **53** specs, dont **19** objets littéraux                                                                                     |
| 2 — doublures rangées | **14** doublures déclarées dans une spec ; 9 fichiers dans `tests/fakes/`                                                                         |
| 3 — deux noms         | **7** vocabulaires : Fake, Stub, Spy, InMemory, Capturing, Silent, Permissive                                                                     |
| 5 — fabriques         | 4 fabriques ; ~15 helpers recopiés dans 2 à 4 specs                                                                                               |
| 6 — suite juste       | **0** violation : aucun test unitaire ne touche la base                                                                                           |
| 7 — isolation         | **66** hooks recopiés, **51** désactivent les FK, **0** `withGlobalTransaction`, **0** hook de suite ; **5** specs écrivent sans aucune isolation |
| 9 — assertions        | **85** assertions imprécises, **6** `try/catch`                                                                                                   |
| 10 — URLs             | **104** URLs en dur contre **2** `route()`                                                                                                        |

La règle 6 est le seul acquis : elle passe en **[ERROR]** — un test unitaire qui touche la base doit
casser la suite. Les autres décrivent le cap, pas l'état.

Les trois gisements par ordre de risque réel :

1. **Les 51 désactivations de FK** (règle 7) — elles éteignent une vérification de la base, pas une
   commodité de test. C'est le seul point de cette liste qui peut laisser passer une écriture
   orpheline jusqu'en production.

   Vérifié le 2026-08-18 sur trois specs de trois dossiers différents — dont `checkout_flow`, qui
   crée portefeuilles et transactions : **elles passent toutes sans la ligne**. Les seules
   contraintes vers `users` portent sur `wallets.user_id`, `transactions.users_uid` / `user_id`,
   `debit_phones` et `access_tokens` ; un portefeuille d'organisation pose `user_id` à `null`, ce
   qui satisfait la contrainte sans la désactiver, et `organisations.owner_user_id` n'en porte
   aucune. La ligne a probablement été nécessaire avant la bascule account-centric, puis recopiée
   de spec en spec. Elle ne protège aujourd'hui rien de ce qu'elle prétend protéger.

2. **Les 208 casts** (règle 1) — chacun est un contrat qui a cessé d'être comparé.
3. **Les 104 URLs en dur** (règle 10) — sans gravité tant qu'aucune route ne bouge, coûteux le jour
   où l'une bouge.

---

## Ce qui n'est pas concerné

- **`tests/browser/`** — une seule spec, hors de ce cadre.
- **Les fabriques et les doublures elles-mêmes** : elles portent des JSDoc complets (règle 2 des
  JSDoc) parce qu'elles sont du code partagé, mais aucune assertion.
- **Les specs de caractérisation d'un bug** peuvent fixer plus de champs que la règle 5 n'en
  demande, quand c'est la combinaison exacte qui reproduit le défaut. Elles le disent en en-tête.

---

## Ce qui est différé

**L'outillage.** Ces règles ne sont pas exécutables aujourd'hui ; les quatre premières le
deviendraient par une règle ESLint restreinte à `tests/` :

- interdire `as unknown as` / `as any` dans un `*.spec.ts` — la seule qui compte vraiment, et la
  seule qui exige d'abord de résorber 208 occurrences ;
- interdire `SET FOREIGN_KEY_CHECKS` hors d'une liste explicite ;
- interdire une déclaration de classe dans un `*.spec.ts`.

Comme pour dependency-cruiser, une garde ne se pose **qu'une fois la dette à zéro** : la poser sur
208 violations produit un bruit qu'on apprend à ignorer en une semaine.

**L'isolation remontée à la suite.** Les 66 hooks recopiés se remplacent par un `suite.onTest` dans
`configureSuite`, où le serveur HTTP est déjà démarré. Cela ne peut se faire qu'après le retrait des
hooks par spec — deux transactions globales imbriquées ne se rollback pas proprement — et après avoir
identifié les specs qui veulent un autre régime (`truncate` pour le code qui valide ses propres
transactions). C'est la suite naturelle du retrait des désactivations de FK.

**Les fabriques de modèles Lucid.** Il n'y a aujourd'hui aucune `database/factories/` ; les quatre
fabriques de `tests/factories/` écrivent à la main, et posent des porteurs qui n'existent pas
(`organisation.ownerUserId = randomUUID()`). Aucune contrainte ne le sanctionne aujourd'hui, mais
c'est le jour où l'on en ajoutera une sur `organisations.owner_user_id` que la dette se paiera d'un
coup. Des fabriques qui créent le porteur avec l'organisation la préviennent.

---

## Migration

- **Nouveau test** : ces règles s'appliquent immédiatement, entièrement.
- **Test existant** : on l'aligne quand on le touche, dans le changement qui le touche. Un test qu'on
  ne relit pas ne se réécrit pas pour le principe.
- **Une doublure recopiée** est extraite vers `tests/fakes/` à la deuxième occurrence, pas à la
  troisième.
- **Une désactivation de FK** rencontrée dans un test qu'on modifie se remplace par des données
  complètes. Si la fabrique manque, on la crée — c'est le travail, pas un détour.
