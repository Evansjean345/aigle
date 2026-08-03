# Symétrie produit — remonter l'administration aiglesend dans son produit

**Date** : 2026-08-03
**Statut** : approuvé — S1 livré
**Portée** : `app/core/` → `app/products/aiglesend/`

---

## Contexte

Les deux produits ne sont pas construits de la même façon.

`aiglebusiness` porte neuf features dans `app/products/`, chacune avec ses quatre couches, et
consomme le core par ses services — trente-huit appels à `UserDirectoryService`, `WalletService` et
consorts. L'invariant `produit-consomme-core-par-service` le tient en ERROR : ce produit ne peut
importer ni modèle, ni repository, ni infrastructure du core.

`aiglesend` porte deux features seulement, `operations` et `qr`. Tout le reste — les utilisateurs,
leur KYC, leurs portefeuilles — vit dans le core, **présentation admin comprise**. Le core est donc
à la fois le socle partagé et le produit grand public, et rien ne distingue les deux rôles.

La conséquence n'est pas théorique. Le core ne peut pas être extrait tant qu'il contient les écrans
d'un produit, et une feature qui grossit côté aiglesend n'a aucun endroit évident où aller : elle
s'ajoute au core par défaut, ce qui déplace la frontière un peu plus à chaque fois.

---

## S-D1 — La découpe suit l'objet administré

Une zone d'administration appartient au produit dont elle administre les objets. Ce qui sert les
deux produits reste au core.

| Zone                 | Destination          | Pourquoi                                                                                                         |
| -------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `identity/user`      | `products/aiglesend` | l'écran des comptes grand public ; les membres d'organisation se consultent depuis la fiche de leur organisation |
| `identity/kyc`       | `products/aiglesend` | KYC des personnes physiques ; le KYB des organisations vit déjà côté business                                    |
| `money/wallet`       | `products/aiglesend` | portefeuille personnel ; celui d'une organisation est déjà administré côté business                              |
| `audit`              | core                 | journal de toute la plateforme                                                                                   |
| `catalog/catalogs`   | core                 | référentiel des services, providers et tarifications                                                             |
| `money/ledger`       | core                 | grand livre des deux produits                                                                                    |
| `money/transactions` | core                 | transactions des deux produits                                                                                   |
| `identity/device`    | core                 | appareils des deux canaux — `businessDevice` en dépend                                                           |

Le critère est ce que l'écran administre, non qui l'ouvre : le back-office est un seul espace, mais
il administre des objets qui, eux, ont un propriétaire.

**Ce qui ne bouge pas dans les zones déplacées** : `domain/` et `application/services/` restent au
core. Un utilisateur, un portefeuille, un document KYC demeurent des notions du socle —
`aiglebusiness` en dépend et continuera d'en dépendre. Seules partent `presentation/admin/` et
`application/use_cases/admin/`.

---

## S-D2 — Le déplacement est un refactor par service, pas un `git mv`

C'est le point qui décide du coût. Une fois sous `app/products/`, ces fichiers tombent sous
l'invariant **ERROR** `produit-consomme-core-par-service` : ils ne pourront plus importer un modèle
du core, un repository, ni son infrastructure.

Mesure des imports qui deviendraient interdits, sur l'ensemble des fichiers `admin` de chaque zone —
présentation et use cases :

| Zone              | Fichiers | Imports interdits |
| ----------------- | -------- | ----------------- |
| `money/wallet`    | 12       | **6**             |
| `identity/user`   | 14       | **11**            |
| `identity/kyc`    | 17       | **14**            |
| `identity/device` | 20       | **21**            |

Aucune zone n'est déplaçable telle quelle : chacune atteint directement les repositories de sa
propre feature, ce qui est légitime au core et interdit sous `products/`.

Le cas d'`identity/user` mérite d'être isolé, parce qu'il ne se résout pas en exposant les méthodes
manquantes. Ses onze imports se réduisent à quatre opérations — `findById`, `paginate`, `getStats`,
`save` — mais `UserDirectoryService`, seul service exposé aujourd'hui, rend un `UserLookupResult`
de **six champs**, un annuaire minimal conçu pour qu'un produit résolve une identité. La fiche admin
en affiche **cinquante-quatre**.

Déplacer `identity/user` suppose donc de créer un contrat de service distinct pour
l'administration, avec ses propres `Result`. C'est le travail principal de ce lot, pas un
ajustement de chemins.

**L'alternative écartée** : desserrer l'invariant pour laisser un produit atteindre un repository du
core. Elle rendrait le déplacement immédiat, mais viderait de sens la seule règle ERROR qui protège
l'extractibilité — et `aiglebusiness` la respecte déjà sur trente-huit appels.

---

## S-D3 — L'ordre va du moins couplé au plus couplé

Trois lots, dans cet ordre, chacun livrable seul :

| Lot    | Zone            | Travail                                                     | Dépend de |
| ------ | --------------- | ----------------------------------------------------------- | --------- |
| **S1** | `money/wallet`  | déplacement + étendre `WalletService` (statut, ajustements) | —         |
| **S2** | `identity/kyc`  | déplacement + service de lecture des documents et niveaux   | —         |
| **S3** | `identity/user` | déplacement + contrat de service admin et ses `Result`      | —         |

S1 sert de pilote : c'est la zone la moins couplée, et son code vient d'être repris par
l'unification du vocabulaire — il est frais dans les mémoires. Il mesure le coût réel de la
mécanique — chemins d'alias, enregistrement des routes, tests, `depcruise` — sur un volume de
service encore modeste. Si S1 révèle une difficulté imprévue, S2 et S3 ne sont pas engagés.

Aucun lot ne dépend d'un autre : ils touchent des zones disjointes.

L'ordre initial de ce document plaçait `identity/kyc` en tête, sur une mesure erronée qui annonçait
zéro import interdit. Elle ratait le dossier `usecases/admin` — nommé sans séparateur, contrairement
au `use_cases/` du reste du dépôt. La mesure corrigée le place au contraire en avant-dernier.

### Ce que S1 a appris

**Les zones ne sont pas disjointes.** `users_route.ts`, qui reste au core jusqu'à S3, garde
`/users/:id/wallet-stats` par la permission `users.wallets.read`. Déplacer le catalogue du
portefeuille aurait donc fait importer le produit par le core — violation de
`core-ne-depend-pas-du-produit`, en ERROR.

**Le catalogue de permissions reste au core.** Un `permissions.config.ts` n'est pas un écran mais
une déclaration de droits, agrégée par `start/permissions.ts` qui n'appartient ni au core ni au
produit. Le produit l'importe, ce qu'aucun invariant n'interdit : la règle vise les modèles, les
repositories et l'infrastructure. Chaque catalogue migrera avec la dernière route qui le consomme.

**Le vrai travail est en amont du déplacement.** Sur douze fichiers déplacés, dix ont bougé sans
rien changer ; le lot a consisté à refaire trois contrats de service : `adjust` résout désormais
lui-même la transaction depuis sa référence au lieu de recevoir un modèle, `list` projette la page
plutôt que de rendre un paginateur de modèles, et `updateWalletStatus` rend un `Result`. Les
`Result` et leurs projections vivent dans `application/dtos/wallet_adjustment.dto.ts`, au core, à
côté du service qui les produit ; seuls les `RequestDto` et `ResponseDTO` sont partis.

**Aucun test à déplacer.** Cette zone n'avait pas de test d'administration — la décision « les tests
suivent leur zone » n'a pas trouvé à s'appliquer, et reste à vérifier sur S2.

---

## S-D4 — Les features produit gardent le nom de leur objet

`products/aiglesend/user/`, `products/aiglesend/kyc/`, `products/aiglesend/wallet/`, à côté des
`operations` et `qr` existants. Le nom dit ce que la feature administre, comme côté business où
`organisation` et `funding` disent la leur.

Les alias suivent : `#aiglesend/user/...`. Le préfixe existe déjà et est déclaré dans les invariants
de dependency-cruiser.

---

## Ce que le chantier ne fait pas

**Il ne touche pas au chemin client.** Les routes mobiles de `kyc` restent où elles sont : elles
sont servies par le core et consommées par l'application mobile, pas par le back-office. Seule
l'administration remonte.

**Il ne découpe pas les modèles.** Les frontières entre features d'un même contexte restent
différées, avec leurs 103 dépendances relevées le 2026-08-03 — voir
[frontières de service](../rules/2026-08-03-service-boundary-rules.md).

**Il n'ajoute aucune garde depcruise.** L'invariant existant suffit : il s'appliquera de lui-même
aux fichiers déplacés, et c'est précisément ce qui rend le refactor vérifiable.

---

## Ce qu'on saura à la fin

Le core ne contiendra plus d'écran d'administration d'un objet appartenant à un produit. Les deux
produits seront construits pareil, et la question « où va cette feature ? » aura une réponse qui ne
dépend pas de l'historique.

Mesure de contrôle : `produit-consomme-core-par-service` reste à **0 erreur** après chaque lot.
S'il passe au rouge, c'est qu'un service manque — pas qu'il faut assouplir la règle.

---

## Points ouverts

**Le sort de `identity/device`.** Il est classé core parce que les deux canaux enrôlent des
appareils. Mais l'écran d'administration, lui, ne montre que des appareils de personnes physiques —
les organisations n'en ont pas en propre. Si cette lecture est retenue, `device` devient un
quatrième lot, et le dernier : avec 20 fichiers et 21 imports interdits, c'est la zone la plus
couplée des quatre.

**Les tests.** Ils suivront leur zone (`tests/functional/kyc`, `tests/unit/kyc`…), mais rien
n'impose aujourd'hui que l'arborescence des tests reflète celle du code. À trancher au premier lot,
pour ne pas décider trois fois.
