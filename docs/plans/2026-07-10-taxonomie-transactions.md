---
type: design
statut: brainstorming bouclé — implémentation en cours
derniere_maj: 2026-07-10
session_courante: implémentation
---

# Taxonomie & structuration des transactions

Le système de transactions s'est élargi (paiement marchand externe, dépôt/transfert vers opérateurs
externes, transfert inter-wallet, paiement marchand par wallet, réception d'un autre user, etc.).
`operationType` est devenu **ambigu** — surtout `WALLET_TRANSFERT`, qui recouvre **deux flux
distincts** (transfert entre users **et** paiement marchand interne). But : **structurer une
taxonomie claire et uniforme** pour comprendre, afficher (admin + mobile) et faire évoluer chaque
transaction.

> Méthode : brainstorming **session par session** (proposé → validé → suivant). **Rien codé** tant
> que ce n'est pas bouclé. Migrations lancées par l'utilisateur.

## Constat (état actuel)

`operationType` (`TransactionType`) : `deposit`, `transfert`, `wallet_transfert`, `inter_reseau`
(`TRANSFERT_INTER`), `topup`, `checkout`, (`payout`/`mass_payout` à venir).
`direction` : `debit`, `credit`, `external`.

Mapping scénarios → enregistrement actuel :

| # | Scénario | Flux core | operationType | Party (compte) |
|---|---|---|---|---|
| 1 | Paiement marchand (payeur **externe**, mobile money → marchand) | `external_in` (CHECKOUT) | `checkout` | marchand (org) |
| 2a | Dépôt (cash-in mobile money → wallet user) | `external_in` | `deposit` | user |
| 2b | Transfert vers opérateur externe (wallet → mobile money) | `external_out` | `transfert` | user |
| 2c | Transfert inter-réseau (mobile money → mobile money) | `external_to_external` | `inter_reseau` | user |
| 3 | Transfert inter-wallet (user ↔ user) | `internal_move` | **`wallet_transfert`** | user (2 côtés) |
| 4 | Paiement marchand **par wallet** (user → marchand) | `internal_move` | **`wallet_transfert`** | user (débit) + marchand (crédit) |
| 5 | Réception (user reçoit d'un autre user) | `internal_move` (crédit) | **`wallet_transfert`** | user |
| 6 | User paye un marchand (= 4, côté débit) | `internal_move` (débit) | **`wallet_transfert`** | user |

**Ambiguïté centrale** : #3 (w2w) et #4/#6 (paiement marchand par wallet) portent **le même**
`operationType = wallet_transfert`. Le back-office affiche « Wallet Transfert » pour les deux →
impossible de distinguer un transfert entre amis d'un paiement marchand.

**Déjà corrigé (partiel)** : la partie prenante est nommée uniformément (`party` : user OU marchand
via alias payable) — le `-` a disparu. Mais **le TYPE reste ambigu** et l'affichage n'est pas unifié.

## Agenda

| Session | Sujet | État |
|---|---|---|
| **S1** | Cadrage : dimensions de la taxonomie + objectifs | ✅ validée |
| S2 | Le modèle de « kind » (type discriminant vs flag) : faut-il éclater `wallet_transfert` ? | ✅ validée |
| S3 | Le modèle de « partie prenante » (sender/recipient : user / marchand / opérateur externe) | ✅ validée |
| S4 | Dimensions transverses : interne/externe, direction, sens (in/out), jambe | ✅ validée |
| S5 | Présentation uniforme (admin + mobile) : libellé, icône, party, montant signé | ✅ validée |
| S6 | Migration & compat (données existantes, `operationType`, sans casser les listeners) | ✅ validée |
| S7 | Découpage tracer-bullets + tests | ✅ validée |

---

## S1 — Cadrage  *(proposition, à valider)*

### Objectif
Une **taxonomie unique et non ambiguë** qui répond, pour toute transaction, à : *quel type
métier ?*, *qui est la contrepartie (et sa nature) ?*, *interne ou externe ?*, *sens (entrée/sortie)
?* — et qui pilote un **affichage uniforme** (admin + mobile), sans conflit comme `wallet_transfert`
= w2w = paiement marchand.

### Dimensions candidates (à structurer en S2–S4)
1. **Kind (type métier)** : dépôt, transfert externe, inter-réseau, **transfert P2P (user↔user)**,
   **paiement marchand (interne)**, **encaissement marchand (checkout externe)**, topup, (payout,
   mass-payout, refund).
2. **Contrepartie** : `user`, `merchant` (org), `external_operator` (mobile money) — nom + nature.
3. **Interne vs externe** : l'argent reste dans aigle (wallet↔wallet) vs franchit un opérateur.
4. **Sens / direction** : `debit` (sortie du compte), `credit` (entrée), `external` (jambe opérateur).

### Invariants
- Ne pas casser la **caractérisation argent** existante (les flux/tests core restent verts).
- La taxonomie doit être **dérivable des données** (pas de devinette côté UI).
- Compat : `operationType` reste exploité par des listeners (volume, sécurité) → toute évolution
  additive ou migrée proprement.
- Séparer **la donnée** (comment on enregistre/discrimine) de **la présentation** (libellé/icône).

### Points à trancher pour clore S1
- **P1** — Le périmètre (les 4 dimensions ci-dessus) couvre-t-il ton besoin, ou en manque-t-il une
  (ex. « canal » aiglesend vs aiglebusiness ; « catégorie » entrée/sortie/interne) ?
- **P2** — Objectif principal : d'abord **l'affichage admin/mobile** (présentation), ou d'abord **le
  modèle de données** (discriminant en base) — ou les deux d'un bloc ?
- **P3** — Ampleur acceptée : simple **enrichissement présentation** (dériver le type affiché depuis
  operationType + party, sans toucher la base), ou **refonte du modèle** (nouveau discriminant en
  base, migration) ?

### Décisions S1  *(validées 2026-07-10)*
- **P1 → 4 dimensions suffisent** (kind, contrepartie, interne/externe, direction).
- **P2/P3 → enrichissement PRÉSENTATION** : on **dérive** le type affiché depuis les données
  existantes (operationType + party + direction), **sans migration ni discriminant en base**. Uniformise
  admin + mobile. (Une refonte modèle reste une option future, non retenue ici.)

---

## S2 — Le « kind » d'affichage & sa dérivation  *(proposition, à valider)*

### Kinds d'affichage proposés (dérivés, pas persistés)
`deposit` (Dépôt) · `external_transfer` (Transfert externe / retrait) · `inter_network` (Inter-réseau)
· `merchant_collection` (Encaissement marchand — checkout externe) · `p2p_transfer` (Transfert entre
utilisateurs) · `merchant_payment` (Paiement marchand par wallet) · `topup` · (`refund`, `payout`…).

### Règles de dérivation
| operationType | direction | party (ce leg) | → kind affiché |
|---|---|---|---|
| `deposit` | credit | user | **Dépôt** |
| `checkout` | credit | merchant | **Encaissement marchand** |
| `transfert` | debit | user | **Transfert externe** |
| `inter_reseau` | * | user | **Inter-réseau** |
| `wallet_transfert` | credit | **merchant** | **Paiement marchand reçu** (encaissement wallet) |
| `wallet_transfert` | credit | **user** | **Reçu d'un utilisateur** (P2P entrant) |
| `wallet_transfert` | debit | user | **P2P sortant OU paiement marchand ⚠️** |

> 🔁 **RÉVISION (S6, root fix)** : ce nœud **disparaît**. On décide (P17) que le paiement marchand —
> même financé par un wallet aiglesend — est enregistré `operationType = checkout`, PAS
> `wallet_transfert`. Du coup : `wallet_transfert` = **P2P uniquement** (plus d'ambiguïté), et `checkout`
> = **encaissement marchand toute source** (mobile money OU wallet). Voir S6. Le tableau ci-dessous
> reste pour l'historique du raisonnement ; la dérivation retenue est celle de S6.

### ⚠️ Le nœud (historique) : la **jambe débit** (émetteur) de `wallet_transfert`
Chaque transaction = **un leg**, et son `party` est **son propre** propriétaire (pas la contrepartie).
La **jambe débit** d'un `wallet_transfert` est **toujours un user** — que ce soit un **P2P** (→ user)
ou un **paiement marchand** (→ marchand). Depuis `operationType + party(émetteur) + direction`
**seuls**, on ne peut **pas** distinguer « transfert à un ami » d'un « paiement marchand ». La nature
est portée par la **contrepartie** (le destinataire), pas par le leg émetteur.

Options pour lever l'ambiguïté (présentation, sans migration) :
- **A. Correlation par leg jumeau** : la transaction émettrice référence sa jumelle
  (`relatedReferences`) ; on résout le destinataire → nature (user/marchand). Coûte un lookup/join.
- **B. Heuristique par `description`** : le core écrit déjà « Paiement à {marchand} » vs « Transfert à
  {user} ». Dérivable, mais **fragile** (dépend d'une string).
- **C. Accepter un libellé commun** pour la jambe débit (« Transfert wallet ») et ne distinguer que la
  jambe **crédit** (où le party = marchand ou user est sans ambiguïté). Simple, mais l'émetteur ne
  dit pas s'il a payé un marchand.
- **D. Exposer la contrepartie sur le leg** (petit ajout présentation) : enrichir le DTO d'un
  `counterparty` résolu (nom + nature) pour les mouvements internes — l'émetteur affiche alors
  « Paiement à Boutique X » proprement. *(C'est en réalité la vraie « uniformisation » : chaque leg
  montre SA contrepartie, pas seulement son propre owner.)*

### Points à trancher pour clore S2
- **P4** — Lève-t-on l'ambiguïté de la jambe débit ? Option **A/B/C/D** ? *(reco : **D** — exposer la
  contrepartie résolue par leg ; c'est ce qui uniformise vraiment l'affichage.)*
- **P5** — Le jeu de **kinds d'affichage** ci-dessus est-il complet / bien nommé ?

### Décisions S2  *(validées 2026-07-10)*
- **P4 → D** : chaque leg **expose sa contrepartie résolue** (`counterparty` : nom + nature), pas
  seulement son propre owner. C'est le vrai levier d'uniformisation.
- **P5 → kinds validés** : `deposit`, `external_transfer`, `inter_network`, `merchant_collection`
  (checkout externe), `p2p_transfer`, `merchant_payment`, `topup` (+ `refund`, `payout` à venir).

---

## S3 — Le modèle de contrepartie  *(proposition, à valider)*

**But** : définir la forme d'un `counterparty` par leg, et **d'où on tire la donnée** — c'est ici que
l'option D se heurte à la réalité des enregistrements.

### Forme cible (présentation, ajoutée au DTO de transaction)
```ts
counterparty: {
  nature: 'user' | 'merchant' | 'external_operator'
  name: string | null          // « Boutique X », « Guy Roland », « Wave »
  accountId?: string           // si interne (user/merchant)
  userId?: string              // si user (lien profil admin)
  operator?: string            // si externe (wave, orange…)
  phone?: string               // si externe
}
```

### D'où vient la donnée, leg par leg
| Scénario (leg) | Contrepartie | Source **déjà disponible** ? |
|---|---|---|
| Dépôt (crédit user) | opérateur externe | ✅ `payment.paymentDetails` (operator + phone) |
| Transfert externe (débit user) | opérateur externe | ✅ `payment.paymentDetails` |
| Inter-réseau | 2 opérateurs | ✅ `payment[0/1]` |
| Encaissement marchand / checkout (crédit marchand) | payeur externe | ✅ `payment.paymentDetails` |
| P2P **crédit** (user reçoit) | user émetteur | ✅ `payment.paymentDetails.user` (nom écrit) |
| P2P **débit** (user envoie) | user destinataire | ✅ `payment.paymentDetails.user` (nom écrit) |
| Paiement marchand **crédit** (marchand reçoit) | user payeur | ✅ `payment.paymentDetails.user` |
| **Paiement marchand débit (user paye)** | **marchand** | ⚠️ **nom marchand PAS dans le payment** |

### ⚠️ Le trou de donnée
Pour tous les legs sauf un, la contrepartie est **déjà** dans `payment.paymentDetails` (opérateur/phone
pour l'externe ; `user` = nom écrit pour l'interne). **Sauf la jambe débit d'un paiement marchand** :
le payment côté payeur ne contient **pas** le nom du marchand (le core écrit `{ operator: WALLET }`
sans label marchand ; seul le `description` porte « Paiement à {marchand} »).

Trois façons de combler ce seul trou :
- **S3-a. Résolution par alias au moment de l'affichage** : on a l'`accountId` de la contrepartie ?
  → non, le leg débit ne stocke que SON accountId (le user). Il faudrait retrouver le compte marchand
  via le leg jumeau → **join/lookup** (comme option A de S2). Batchable côté admin (`mapDisplayNamesByAccountIds`).
- **S3-b. Enrichir le payment à l'écriture** : que `createInternalPayment` écrive aussi le label
  marchand dans `paymentDetails` du leg payeur (comme il écrit déjà `user` pour le P2P). **Pas de
  migration** (colonne JSON existante), mais ne corrige que les **nouvelles** transactions.
- **S3-c. Parser le `description`** (« Paiement à … ») pour ce seul cas résiduel. Fragile, mais couvre
  le legacy sans lookup.

*Combo pragmatique possible* : **S3-b** pour le futur (propre, zéro lookup) **+ S3-c** en fallback
pour l'historique — ou **S3-a** si on veut une résolution garantie et centralisée.

### Points à trancher pour clore S3
- **P6** — La **forme** `counterparty` ci-dessus convient-elle (nature/name/accountId/userId/operator/phone) ?
- **P7** — Comment comble-t-on **le seul trou** (jambe débit paiement marchand) : **S3-a** (lookup jumeau),
  **S3-b** (enrichir le payment à l'écriture), **S3-c** (parser description), ou **combo b+c** ?
  *(reco : **b + c** — écrire le label marchand désormais, parser le legacy en fallback ; zéro migration,
  zéro lookup en régime permanent.)*

### Décisions S3  *(RÉVISÉES 2026-07-10 — privacy-first)*
> ⚠️ Révision majeure : **on ne résout JAMAIS le nom d'un utilisateur côté backend** — ce serait
> exposer une donnée personnelle à un pair. La contrepartie « user » ne porte que `{ phone, operator }` ;
> **c'est l'app** qui résout le numéro en nom **localement, contre le carnet de contacts** du porteur.
> Seul le **nom marchand** (identité commerciale) est renvoyé par le backend.

**Forme révisée** (par leg) :
```ts
type Counterparty =
  | { nature: 'user';     phone: string | null; operator: string }  // app → résout contact local
  | { nature: 'merchant'; name: string;         operator: string }  // nom commercial (exposable)
  | { nature: 'external'; phone: string | null; operator: string }  // PSP mobile money
```
Plus de `name`/`userId`/`firstname-lastname` pour un user. (Le nom reste éventuellement stocké dans
`paymentDetails.user`, mais **n'est plus exposé** dans le DTO de présentation.)

**`operator` d'un mouvement interne = `'aiglesend'`** (pas `'wallet'`). Vue marchand qui reçoit d'un
client → `{ nature: 'user', phone: numéro aiglesend du client, operator: 'aiglesend' }`. Vue payeur P2P
→ `{ nature: 'user', phone: numéro du destinataire, operator: 'aiglesend' }`. (`PaymentMethod.WALLET`
reste la valeur stockée en base ; `'aiglesend'` est le **libellé opérateur exposé** en présentation.)

**Règles d'affichage côté app** (résolution du contact local) :
- P2P envoyé (débit) → « Envoyé à **{contact|phone}** »
- P2P reçu (crédit) → « Reçu de **{contact|phone}** »
- Paiement marchand, vue **payeur** (débit) → « Paiement chez **{nom_marchand}** »
- Vue **marchand** qui reçoit (crédit) → « Reçu de **{contact|phone}** »
- Dépôt / transfert externe / inter-réseau → « … **{operateur} · {phone}** »

**Disponibilité (vérifiée dans `internal_move.use_case.ts`)** :
- P2P (2 legs) : `paymentDetails.phone` **déjà écrit** ✅ → zéro changement, juste ne plus exposer le nom.
- Marchand qui reçoit : phone du payeur **déjà écrit** ✅.
- **Paiement marchand, leg payeur** : `recipientWallet.user === null` → payment = `{ operator: WALLET }`
  **sans phone ni nom** ⚠️ → **seul** point à enrichir : y écrire `{ operator: WALLET, name: nom_marchand }`.

**P6 → forme révisée validée** (phone+operator pour user/external ; name+operator pour merchant).
**P7 → combo b+c ciblé** : (**b**) enrichir `createInternalPayment` pour écrire le **nom marchand**
sur le leg payeur ; (**c**) parser le `description` (« Paiement à … ») en **fallback legacy**. Aucune
migration ; le numéro P2P est déjà présent.

---

## S4 — Dimensions transverses & objet dérivé unique  *(proposition, à valider)*

Les 3 dimensions restantes (S1) sont **toutes dérivables** de `operationType + direction`. Plutôt que
de les recalculer dans chaque écran, on expose **un seul objet dérivé** (`display`) que l'admin ET le
mobile consomment tel quel.

### Les dimensions transverses
- **scope** `internal | external` : l'argent reste dans aigle (wallet↔wallet) vs franchit un opérateur.
  → `wallet_transfert` = **internal** ; `deposit`/`transfert`/`inter_reseau`/`checkout` = **external**.
- **flow** `in | out | neutral` : sens **du point de vue du compte du leg**. `credit` = **in** (+),
  `debit` = **out** (−), `external` (jambe opérateur pure d'inter-réseau) = **neutral**.
- **direction** : conservée telle quelle (`debit`/`credit`/`external`) — dimension brute déjà en base.

### L'objet dérivé unique (présentation) — répartition backend / client
```ts
// Backend : CLASSIFICATION uniquement (dérivée, identique admin + mobile)
display: {
  kind: 'deposit' | 'external_transfer' | 'inter_network' | 'merchant_collection'
      | 'p2p_transfer' | 'merchant_payment' | 'topup' | 'refund' | 'payout'
  scope: 'internal' | 'external'
  flow: 'in' | 'out' | 'neutral'      // pilote signe (+/−) et couleur
  counterparty: Counterparty          // S3 : phone+operator (user/ext) OU name+operator (merchant)
}
// Client : compose le LIBELLÉ humain à partir de kind + counterparty
//   - user     → résout phone → contact local → « Envoyé à / Reçu de {contact|phone} »
//   - merchant → « Paiement chez {name} »
//   - external → « {operateur} · {phone} »
```
Le **montant signé** se dérive de `flow` (in=+, out=−) — calculable des deux côtés.

### Où vit la dérivation ? (frontière backend / client)
La **privacy impose la frontière** : le backend **ne peut pas** livrer le libellé final d'une
contrepartie user (il dépend des contacts du porteur). D'où une répartition nette :
- **Backend (reco S4-a pour la classification)** : un **service de présentation** dans le core
  transactions calcule `kind`/`scope`/`flow` + assemble `counterparty` (phone/operator ou nom
  marchand). Règle de classification **écrite une seule fois** → admin et mobile la reçoivent identique.
- **Client (imposé pour le libellé user)** : résolution `phone → contact` (carnet local) et
  composition du texte « Envoyé à / Reçu de / Paiement chez ». Jamais côté backend.

→ Ce n'est pas S4-a **vs** S4-b : c'est **backend = classification + contrepartie brute**, **client =
résolution contact + libellé**. La règle ambiguë (kind) reste centralisée ; seule la personnalisation
contact (par nature privée) vit côté client.

### Points à trancher pour clore S4
- **P8** — Adopte-t-on l'objet `display` = **{ kind, scope, flow, counterparty }** côté backend
  (sans `label` final) + composition du libellé côté client ?
- **P9** — Confirme-t-on la frontière : **classification backend** (service de présentation core) /
  **libellé + résolution contact client** ?
- **P10** — `flow` à 3 valeurs (`in`/`out`/`neutral`) suffit-il ? *(inter-réseau = jambe `external`
  pure → `neutral`.)*

### Décisions S4  *(validées 2026-07-10)*
- **P8 → A** : objet backend `display = { kind, scope, flow, counterparty }` (sans libellé final) ;
  libellé humain composé côté client.
- **P9 → frontière validée** : classification (`kind`/`scope`/`flow` + assemblage `counterparty`)
  **backend** (service de présentation core) ; résolution contact + libellé **client**.
- **P10 → `flow` à 3 valeurs** : `in` (crédit, +), `out` (débit, −), `neutral` (jambe `external`
  pure d'inter-réseau — transit opérateur→opérateur, pas de +/− sur un wallet).

---

## S5 — Présentation uniforme (admin + mobile)  *(proposition, à valider)*

**But** : traduire l'objet `display` (S4) en rendu concret — **icône, couleur, montant signé, libellé** —
de façon identique côté admin (Vue) et mobile (TS), et lister **ce que ça remplace** dans l'existant.

### Contrat de rendu par `kind`
| kind | flow | icône | couleur | montant | libellé (motif) |
|---|---|---|---|---|---|
| `deposit` | in | ↓ wallet | vert | `+` | « Dépôt » |
| `external_transfer` | out | ↑ | rouge | `−` | « Transfert vers {operateur} » |
| `inter_network` | neutral | ⇄ | gris | (non signé) | « {op. source} → {op. destination} » |
| `merchant_collection` | in | 🏪↓ | vert | `+` | « Encaissement » |
| `p2p_transfer` | out | 👤↑ | rouge | `−` | « Envoyé à {contact\|phone} » |
| `p2p_transfer` | in | 👤↓ | vert | `+` | « Reçu de {contact\|phone} » |
| `merchant_payment` | out | 🏪↑ | rouge | `−` | « Paiement chez {nom_marchand} » |
| `merchant_payment` | in | 🏪↓ | vert | `+` | « Reçu de {contact\|phone} » *(vue marchand)* |

**Le libellé = f(kind, flow, counterparty)** — le **verbe** vient du `flow` (in → « Reçu de », out →
« Envoyé à / Paiement chez »), la **cible** vient du `counterparty`. Le `kind` choisit icône + le mot
marchand vs contact.

### Où vit la composition
- **Helper partagé (esprit)** `composeTransactionLabel(display, { resolveContact? })` :
  - `resolveContact` fourni (**mobile**) → « Reçu de {carnet[phone] ?? phone} ».
  - `resolveContact` absent (**admin**) → montre le **phone brut** (l'admin est autorisé ; en plus il
    garde `party` = titulaire du compte, avec nom, qu'il gère déjà).
- Deux implémentations (Vue / TS) mais **une seule table de règles** (celle ci-dessus), copiée à
  l'identique — la **classification** (source d'ambiguïté) reste, elle, backend et unique.
- **Montant signé** : `flow` → `+` / `−` / (aucun). Calculable des deux côtés.

### Ce que ça remplace
- **Admin `TransactionListItem.vue`** : le branchement actuel sur `party.type` → colonne pilotée par
  `display` (icône+kind+libellé, `party` reste pour le titulaire du compte).
- **Admin `TransactionDetailsFlow.vue`** : le `switch (operationType, direction)` qui reconstruit
  Émetteur/Bénéficiaire → alimenté par `counterparty` + `flow` (plus de devinette côté Vue).
- **Admin `TransactionListCard.vue` / `[id].vue`** : `party?.name` conservé (titulaire) ; la
  contrepartie affichée via `display.counterparty`.
- **Mobile** : les items de liste de transactions consomment `display` + `resolveContact` (carnet) ;
  suppression des libellés dérivés à la main de `operationType`.

### Points à trancher pour clore S5
- **P11** — La table de rendu (icône/couleur/montant/libellé par kind×flow) te convient-elle, ou tu
  veux ajuster des libellés/icônes ?
- **P12** — Confirme-t-on le **helper `composeTransactionLabel` à deux implémentations, une seule table
  de règles** (mobile avec `resolveContact`, admin sans → phone brut) ?
- **P13** — Côté **admin**, garde-t-on `party` (titulaire, avec nom) **en plus** de la contrepartie, ou
  on unifie tout sur `display.counterparty` ? *(reco : garder `party` — l'admin gère le titulaire, la
  contrepartie complète la lecture du flux.)*

### Décisions S5  *(validées 2026-07-10)*
- **P11 → table de rendu validée** (icône/couleur/montant/libellé par `kind × flow`).
- **P12 → helper `composeTransactionLabel`** à deux implémentations (Vue/TS), **une seule table de
  règles** ; mobile avec `resolveContact`, admin sans (phone brut).
- **P13 → admin garde `party`** (titulaire, avec nom) **+** `display.counterparty` (lecture du flux).

---

## S6 — Migration & compatibilité  *(proposition, à valider)*

Décision S1 = **zéro migration de schéma**. S6 verrouille que l'enrichissement est **purement additif**
et ne casse ni les listeners ni le legacy.

### Ce qui NE change pas (compat garantie)
- **`operationType` / `direction` intacts en base et dans le DTO** → les consommateurs existants
  (stats de volume `walletTransferVolume`, listeners sécurité/volume, refund) continuent tels quels.
- `display` est **ajouté** au DTO (admin + mobile), à côté de `operationType`/`party` — aucune
  suppression de champ existant.

### Les seuls changements de données (sans migration)
1. **Écriture additive (S3-b)** : `createInternalPayment` écrit `name: nom_marchand` dans le
   `payment_details` (colonne JSON existante) du **leg payeur** d'un paiement marchand. N'affecte que
   les **nouvelles** transactions ; aucun autre flux ne lit ce champ aujourd'hui → non-cassant.
2. **Arrêt d'exposition du nom user** : le nom peer (`paymentDetails.user`) **n'est plus mappé** dans
   la contrepartie mobile (privacy). Reste en base ; l'admin peut continuer à le voir. À vérifier :
   qu'aucun écran mobile ne lit déjà `paymentDetails.user` pour un pair (sinon le retirer).

### Données legacy (transactions déjà en base)
| Cas legacy | Résolution contrepartie | OK ? |
|---|---|---|
| P2P (2 legs) | `paymentDetails.phone` **déjà présent** | ✅ rétroactif |
| Marchand qui reçoit | phone payeur **déjà présent** | ✅ rétroactif |
| Externe (dépôt/transfert/inter) | `paymentDetails` (operator+phone) | ✅ rétroactif |
| **Paiement marchand, leg payeur (ancien)** | ni phone ni nom → **fallback parse `description`** (« Paiement à … ») ; sinon libellé générique « Paiement marchand » | ⚠️ dégradé mais lisible |

→ Aucun backfill requis. Le seul cas dégradé (ancien leg payeur marchand) tombe sur le fallback S3-c ou
un libellé générique — acceptable, et se résorbe naturellement avec les nouvelles transactions.

### 🔁 Root fix : paiement marchand = `checkout` (pas `wallet_transfert`)
**Principe** : un paiement marchand est un **encaissement**, quelle que soit la source des fonds
(mobile money **ou** wallet aiglesend). On le classe donc `operationType = checkout` **au moment de
l'écriture**, ce qui **dissout l'ambiguïté dans la donnée** (plus besoin de la deviner en présentation).

**Effet sur la taxonomie** (dérivation **définitive**) :
| operationType | direction | party | → kind |
|---|---|---|---|
| `checkout` | credit | merchant | **merchant_collection** (encaissement — externe **ou** interne) |
| `checkout` | **debit** | user | **merchant_payment** (paiement chez marchand, par wallet) |
| `wallet_transfert` | debit | user | **p2p_transfer** out ✅ *(plus d'ambiguïté)* |
| `wallet_transfert` | credit | user | **p2p_transfer** in |
| `deposit`/`transfert`/`inter_reseau` | … | user | dépôt / transfert externe / inter-réseau |

`checkout` acquiert une jambe **débit interne** (le payeur aiglesend) qu'il n'avait pas — aujourd'hui
un checkout externe n'a qu'une jambe crédit (marchand). C'est cohérent : **une opération checkout, deux
jambes** quand le payeur est interne.

**Implémentation** : `internal_move` accepte un `transactionType` optionnel (défaut `WALLET_TRANSFERT`) ;
le use case **`pay_merchant`** le passe à `CHECKOUT` (les deux jambes). Les mécanismes de mouvement
(débit/crédit wallet, event `WalletToWalletTransactionCompleted` avec `type: 'merchant'`) restent
inchangés — seul le **label operationType** posé sur les lignes change. Aucune migration de schéma
(`checkout` existe déjà dans l'enum).

### Points à trancher pour clore S6
- **P14** — Zéro migration de schéma : DTO additif (`display`) + écriture additive (nom marchand sur le
  leg payeur) + reclassement `checkout` à l'écriture ?
- **P15** — Legacy paiement-marchand (anciens `wallet_transfert`) : **(a)** migration de reclassement
  vers `checkout` (identifiable via `ownerType` du compte destinataire = marchand), ou **(b)** laisser
  le legacy tel quel et le résoudre en présentation (contrepartie marchand → kind marchand_payment) ?
  *(reco : b — pas de backfill risqué ; la présentation gère déjà les deux via `counterparty`.)*
- **P16** — On garde `operationType`/`direction` dans le DTO (pas de dépréciation) → stats/listeners
  intacts. Note : les stats `checkout` **incluront** désormais l'encaissement interne (voulu).
- **P17** — On confirme le **root fix** : `pay_merchant` enregistre `checkout` (2 jambes) via
  `internal_move(transactionType: CHECKOUT)` ?

### Décisions S6  *(validées 2026-07-10)*
- **P14 → zéro migration schéma** : DTO additif `display` + écriture additive nom marchand + reclassement
  `checkout` à l'écriture.
- **P15 → b** : legacy laissé tel quel ; résolu en présentation via `counterparty` (pas de backfill).
- **P16 → garde `operationType`/`direction`** : stats/listeners intacts ; stats `checkout` incluront
  l'encaissement interne (voulu).
- **P17 → root fix confirmé** : `pay_merchant` enregistre `checkout` (2 jambes) via
  `internal_move(transactionType: CHECKOUT)`.

---

## S7 — Découpage tracer-bullets + tests  *(proposition, à valider)*

Slices **verticales** (un comportement → une implémentation → test), pas de slicing horizontal. Ordre
backend → clients. **L'utilisateur lance les migrations** (ici aucune de schéma). Suite API :
`PORT=3399 node --enable-source-maps --import @poppinss/ts-exec bin/test.ts`.

### Emplacement du service de dérivation
`app/core/money/transactions/application/services/transaction_display_service.ts` — pur, sans I/O :
`toDisplay(transaction): { kind, scope, flow, counterparty }`. Consommé par le DTO mobile **et** le DTO
admin (une seule règle de classification). La composition du **libellé** reste côté client (S4/S5).

### Les slices
| # | Slice (comportement) | Test prioritaire |
|---|---|---|
| **B1** | `internal_move` accepte `transactionType?` (défaut `WALLET_TRANSFERT`) | unit : P2P reste `wallet_transfert` (non-régression) |
| **B2** | `pay_merchant` passe `CHECKOUT` (2 jambes) + écrit `name: nom_marchand` dans `paymentDetails` du leg payeur | unit/func : les 2 lignes sont `checkout` ; leg payeur porte le nom marchand |
| **B3** | `TransactionDisplayService.toDisplay` — dérive `kind`/`scope`/`flow` (table S6) | **unit, cœur** : dataset couvrant deposit / transfert / inter-réseau / checkout×(credit,debit) / wallet_transfert×(credit,debit) |
| **B4** | Assemblage `counterparty` (phone+operator user/ext ; name+operator merchant ; `operator:'aiglesend'` interne) | unit : chaque nature ; **jamais** de nom user exposé |
| **B5** | `display` sérialisé dans le DTO **mobile** de transaction | func HTTP : présence + valeurs sur les scénarios clés |
| **B6** | `display` sérialisé dans le DTO **admin** (à côté de `party` conservé) | func HTTP : `party` **et** `counterparty` présents |
| **F1** | Mobile : `composeTransactionLabel` + `resolveContact` (carnet) ; liste consomme `display` | unit TS (règles libellé) ; libellé « Reçu de {contact\|phone} » |
| **F2** | Admin : `composeTransactionLabel` (Vue, sans resolveContact) ; refonte `TransactionListItem` + `TransactionDetailsFlow` sur `display`/`counterparty` | rendu : plus de `switch(operationType)` deviné |
| **D1** | Swagger : `display`/`counterparty` dans les schémas transaction (mobile + admin) | doc à jour **même passe** |

### Priorités de test (fintech — comportement, pas implémentation)
1. **B3** (dérivation) — le cœur : toute la désambiguïsation en dépend. Dataset exhaustif kind×flow.
2. **B2** (checkout) — garantit le root fix : pay-merchant ≠ wallet_transfert.
3. **B4** (privacy) — assertion **négative** clé : aucun nom d'utilisateur dans la contrepartie.
4. Non-régression : les 4 échecs pré-existants restent le seul rouge attendu.

### Points à trancher pour clore S7
- **P18** — L'ordre des slices (B1→B6, F1→F2, D1) et l'emplacement `transaction_display_service.ts`
  te conviennent ?
- **P19** — Le service `toDisplay` renvoie-t-il **aussi `signedAmount`** (dérivé de flow), ou on laisse
  le signe au client ? *(reco : flow suffit côté backend ; signe composé client — cohérent avec P8.)*
- **P20** — On démarre l'implémentation après ton **feu vert explicite** (règle workflow : brainstorm
  bouclé ≠ autorisation de coder) ?

### Décisions S7  *(validées 2026-07-10)*
- **P18 → ordre B1→B6, F1→F2, D1** validé ; service `transaction_display_service.ts` dans
  `core/money/transactions/application/services/`.
- **P19 → pas de `signedAmount` backend** : `toDisplay` renvoie `{ kind, scope, flow, counterparty }` ;
  le signe est composé côté client depuis `flow`.
- **P20 → GO** : implémentation lancée (feu vert explicite).

---

## Journal d'implémentation
- **B1 ✅** — `internal_move` honore `cmd.type` pour le `operation_type` (tx + payment) ; validation
  et ledger restent en sémantique `wallet_transfert` (mécanisme wallet-to-wallet). `recordWalletTransfer`
  accepte un `operationType` optionnel pour ne pas laisser `checkout` fuiter dans le ledger.
- **B2 ✅** — `pay_merchant` enregistre `checkout` (2 jambes) ; nom marchand écrit dans `paymentDetails`
  du leg payeur. Test fonctionnel : `operationType=checkout` ×2 + nom marchand + ledger `wallet_transfert`
  **verts** (l'échec résiduel du test = frais 1% configurés côté admin, hors périmètre taxonomie).
- **B3/B4 ✅** — `TransactionDisplayService.toDisplay` (pur) + 13 tests unitaires verts (table de
  dérivation + assertions privacy : aucun nom user exposé).
- **B5/B6 ✅** — `display` sérialisé dans `MobileTransactionResponseDTO` et `AdminTransactionResponseDTO`
  (à côté de `party`).
- **D1 ✅** — swagger `transactions.yaml` : schémas `TransactionDisplay` + `TransactionCounterparty`,
  `display` branché sur `TransactionDetail` + exemples liste/détail. YAML validé.
- **F1 ✅** — mobile : type `TransactionDisplay`/`counterparty` + `display` sur `Transaction` ;
  dispatcher `ItemTransaction` route par `display.kind` (gère `checkout`, fallback legacy) ;
  `WalletTransferItem` gère la contrepartie marchand (nom commercial) vs user (contact local via
  `useContactsStore.findByPhone`, déjà en place). Typecheck propre.
- **F2 ✅** — admin : types `TransactionKind`/`TransactionDisplay`/`counterparty` + `CHECKOUT` à
  l'enum ; helpers `getTransactionKindLabel` + `composeTransactionLabel` ; `TransactionListItem`
  affiche le `kind` non ambigu + la contrepartie composée. `TransactionDetailsFlow` : cas `checkout`
  branché sur `display.counterparty` (bénéficiaire = nom marchand au lieu de « Non spécifié »).
  Typecheck propre.
- **Note env** — 4 échecs de frais (`4950/5000`, `7920/8000`, `5950/6000`…) dus à une **règle de frais
  1% configurée côté admin** sur le contexte `TRANSFERT/WALLET/aigle` ; orthogonaux à la taxonomie
  (le code ne touche pas aux frais ; `wallet_to_wallet` reste vert). Baseline pré-existant : 3 KYC + 1
  ProviderErrorService.
- **G1 ✅ (2026-07-11)** — journal d'activité complet pour les flux **internes** : `internal_move`
  émet désormais `CREATED` / `VALIDATION_PASSED` / `FEES_CALCULATED` (miroir du flux externe
  `emitLifecycle`) avant le mouvement d'argent. Un paiement marchand / transfert Aigle affiche donc
  6 événements (Création → Validation → Frais → Débit → Écriture → Succès) au lieu de 3. `CREATED`
  porte `actorId = initiateur` + IP (metadata géo), `transactionType = cmd.type`. Tests internes 5/5.
- **Affichage titulaire account-centric ✅ (2026-07-11)** — `AccountHolderResolver` (résolution par
  `account_id`, cf. [[R4]] backlog) branché sur transactions admin + ledgers ; ajustement admin
  désormais possible sur un wallet d'organisation. Suite 346/350 (baseline 4).
