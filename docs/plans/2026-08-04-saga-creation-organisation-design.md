# Création d'organisation en saga — Design

**Date** : 2026-08-04
**Statut** : approuvé — G1 livré
**Portée** : `create_organisation.use_case.ts` et son flux

---

## Contexte

`create_organisation` ouvre une transaction qui englobe quatre collaborateurs de features
différentes : `accountService` (core/identity), `payableAliasService` (core/qr), le repository des
organisations et `membershipService` (produit). **Trois frontières.** Le jour où l'une d'elles passe
derrière une API, cette transaction n'existe plus.

C'est l'une des trois violations restantes de `transaction-portee-par-le-service`, et la seule qui
relève vraiment de la saga — voir
[l'atomicité appartient au service](2026-08-03-atomicite-portee-par-le-service-design.md).

Le patron de référence est le transfert inter-réseau : quatre étapes, chacune avec sa transaction
courte, l'avancement porté par les statuts persistés, l'enchaînement déclenché par webhook.

**Une saga existe déjà à l'intérieur du flux actuel** : `announceOpened` est appelé après commit, et
le portefeuille est créé par un listener sur `AccountOpened`. Le code le documente — « atomicité
compte↔wallet éventuelle ».

---

## S-D1 — Cinq étapes, chacune sa transaction

| #   | Étape                              | Tables écrites                                                                |
| --- | ---------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Organisation en `PROVISIONING`     | `organisations`                                                               |
| 2   | Rôle propriétaire et membership    | `organisation_roles`, `organisation_role_permissions`, `organisation_members` |
| 3   | Ouverture du compte                | `accounts`, puis `wallets` par listener                                       |
| 4   | Alias payable — marchand seulement | `payable_aliases`, `organisations.payable_code`                               |
| 5   | Activation                         | `organisations.status = ACTIVE`                                               |

Chaque étape committe dans ses tables définitives. Rien n'est mis de côté ni tenu en attente
ailleurs : ce qui a réussi est en base, exactement comme si l'organisation avait été créée d'un
seul tenant.

L'ordre s'inverse par rapport à aujourd'hui, où le compte et l'alias précèdent l'organisation. Cet
ordre n'existait que pour satisfaire la transaction unique : l'organisation avait besoin du
`payableCode`. En saga, elle naît sans, et l'étape 4 le lui attache.

---

## S-D2 — Le membership passe en deuxième, pour que le propriétaire voie son organisation

La liste « mes organisations » part des **memberships actifs**, pas des organisations. Créer le
membership en dernier produirait ce parcours :

1. le marchand crée son organisation ;
2. l'étape 3 échoue ;
3. l'organisation existe en `PROVISIONING`, sans membership ;
4. **sa liste est vide** — il croit que la création a échoué ;
5. il réessaie, et reçoit « vous avez déjà un compte marchand » ;
6. il est bloqué, sans rien voir.

Le membership créé en étape 2, l'organisation apparaît quel que soit le point d'échec, avec un état
explicite — « configuration en cours » — et ses actions désactivées. Le propriétaire sait qu'elle
existe et n'essaie pas de la recréer.

---

## S-D3 — L'état de la saga est déduit, non stocké

Aucune colonne d'avancement, aucune table d'orchestration. Le job de reprise interroge les tables :
le compte existe-t-il pour cet `ownerRef` ? l'alias existe-t-il ? Il reprend à la première absence.

C'est ce que fait la saga inter-réseau, dont l'état vit dans les statuts des paiements. Une colonne
`provisioning_step` serait plus directe à lire, mais elle peut mentir — une écriture qui passe sans
que la colonne suive, et l'état affiché ne correspond plus à la réalité. Les tables, elles, ne
mentent pas.

Ce choix est peu coûteux parce que **deux étapes sur quatre sont déjà idempotentes** :
`openAccount` fait `existing ?? create`, `payableAlias.register` renvoie l'alias existant. Le job
peut rejouer sans condition.

---

## S-D4 — L'étape 2 doit devenir idempotente

C'est le seul vrai travail technique. `seedForNewOrganisation` crée le rôle propriétaire sans
vérifier son existence.

Le risque n'est pas le doublon : `organisation_roles` porte une contrainte unique sur
`(organisation_id, slug)`, et `organisation_members` sur `(organisation_id, user_id)`. Rejouée,
l'étape **échouait sur une violation de contrainte** — `Duplicate entry … for key
organisation_roles_organisation_id_slug_unique`. La base protégeait la cohérence, mais la reprise
plantait au lieu de reprendre.

Elle cherche désormais le rôle et le membre avant de les créer, et remplace les permissions au lieu
de les ajouter. Un test rejoue l'amorçage deux fois et vérifie l'unicité des trois écritures ; il a
été vérifié qu'il échoue sans la correction.

---

## S-D5 — Une organisation en cours de création occupe sa place

La contrainte « ≤ 1 marchand par utilisateur » compte les `PROVISIONING`. Un propriétaire ne peut
pas en créer une seconde pendant que la première se configure.

C'est tenable **parce que** S-D2 la rend visible : il voit ce qui l'empêche de recommencer. Sans
cette visibilité, la contrainte serait un piège.

---

## S-D6 — Un échec durable remonte au back-office

Au-delà d'un délai, une organisation restée en `PROVISIONING` apparaît dans un écran
d'administration avec son point de blocage — quelle étape manque. Un gestionnaire arbitre.

Rien n'est supprimé : le projet ne supprime nulle part, et une organisation à moitié configurée
doit rester visible plutôt que disparaître. Pas de statut `FAILED` non plus — il libérerait la
contrainte et laisserait une organisation morte en base sans qu'on sache quoi en faire.

---

## Ce qui est déjà en place

**La garde `activeOrganisation` refuse tout ce qui n'est pas `ACTIVE`.** Une organisation en
`PROVISIONING` est donc inaccessible sur les 25 routes scopées, sans une ligne supplémentaire. Elle
ne peut ni encaisser ni décaisser. L'état intermédiaire est sûr par construction — c'est le travail
du lot O3 qui le garantit.

Le message de `OrganisationBlockedException` devra en revanche distinguer les deux cas : « cette
organisation est suspendue, contactez le support » est faux pour une création en cours.

**Le portefeuille naît déjà hors transaction**, par listener. L'étape 3 n'a pas à l'attendre.

---

## Découpage

| Lot    | Contenu                                                                                   | Dépend de |
| ------ | ----------------------------------------------------------------------------------------- | --------- |
| **G1** | Rendre `seedForNewOrganisation` idempotente                                               | —         |
| **G2** | Statut `PROVISIONING`, découpage du use case en cinq étapes, message d'exception distinct | G1        |
| **G3** | Job de reprise à état déduit                                                              | G2        |
| **G4** | Écran back-office des organisations bloquées                                              | G2        |

G1 est livrable seul et sans risque : rendre une opération idempotente ne change rien au flux
actuel.

---

## Ce qu'on saura à la fin

`create_organisation` n'ouvrira plus de transaction franchissant trois frontières. Les violations
de `transaction-portee-par-le-service` passeront de 3 à 2, et les deux restantes — `register` et
`execute_admin_refund` — seront traitables séparément, la seconde probablement sans saga du tout.

Une organisation ne pourra plus être créée à moitié en silence : elle le sera visiblement, et
reprenable.
