# Prompt de reprise — Vérification d'entreprise (KYB)

> À coller tel quel au démarrage d'une nouvelle session.

---

Nous allons concevoir puis implémenter la **vérification d'entreprise (KYB)** : les documents qu'une
organisation soumet, leur revue, et le palier de compte qui en découle.

**Commence par un brainstorming** — invoque le skill `brainstorming` et suis son processus depuis
l'étape 0. Ne code rien avant que le design soit approuvé, et découpe-le en lots livrables comme les
chantiers précédents.

Lis d'abord `docs/plans/remarques-a-brainstormer.md`, remarque **R5** (🟠 Majeur). Elle porte déjà
deux décisions **actées avec l'utilisateur**, à ne pas rouvrir sans raison :

1. **Le KYB vit dans le core, pas dans le produit business.** L'invariant depcruise
   `core-ne-depend-pas-du-produit` l'impose : le palier du compte dérive de la vérification, donc un
   KYB côté produit créerait `core → produit`. La feature `core/identity/kyc` cesse d'être « KYC
   identité » pour devenir **« vérification de compte »**, les cas se distinguant par `ownerType`.
2. **Ancrage sur le compte dès le départ** — `account_id`, jamais `organisation_id`. Le core ne
   connaît pas le modèle `Organisation` : RCCM et DFE sont des **champs de document**, pas une
   relation métier.

---

## État constaté le 2026-08-05

Vérifie que ça tient toujours avant de t'appuyer dessus — mais ces relevés viennent du code, pas de
la mémoire.

### La fondation account-centric est en place

Le refactor `2026-07-10-refactor-account-centric-validation.md` est livré. Concrètement :

| Ce qui existe | Où |
| --- | --- |
| `accounts.segment` (`particulier` / `marchand` / `enterprise`) et `accounts.level` | `core/identity/account/domain/models/account.ts` |
| Résolution du palier et des limites | `AccountStandingService.getStanding(accountId)` |
| Grille `(segment, level) → limites` | modèle `KycLevel`, colonnes `segment` + `level` |

**La grille est donc déjà unifiée KYC/KYB par segment.** C'est l'essentiel du travail de R5 : il ne
reste pas à inventer le mécanisme du palier, mais à l'alimenter pour les comptes d'organisation.

### La grille est incomplète

Paliers réellement présents en base :

| segment | niveaux |
| --- | --- |
| particulier | 1, 2 |
| marchand | 1 |
| enterprise | 0 (limite unitaire à 0 — bloque les mouvements), 2 |

**`enterprise` niveau 1 manque**, et `marchand` n'a ni 0 ni 2. Le design devra dire quels paliers
existent pour une organisation et ce qu'ils autorisent — c'est une décision produit, pas un oubli
technique à combler mécaniquement.

Rappel du provisioning actuel (`create_organisation.use_case.ts`) : un **marchand** naît au niveau
**1**, une **entreprise** au niveau **0**. Une entreprise ne peut donc rien faire avant son KYB —
c'est le comportement voulu, et le KYB est ce qui doit l'en sortir.

### Les documents sont ancrés sur l'utilisateur

`kyc_documents.user_id` — pas `account_id`. C'est le point de R5 qui demande une **migration**, et
elle est facilitée par l'invariant β du refactor : pour un compte utilisateur, `account_id ==
usersUid`. La reprise est donc une copie de colonne, pas une résolution.

### Une tension à trancher : où vit la revue ?

Le lot **S2** (`2026-08-03-symetrie-produit-aiglesend-design.md`) a déplacé la revue administrative
du KYC dans le **produit** :

```
app/products/aiglesend/kyc/application/usecases/admin/process_kyc_document.usecase.ts
app/products/aiglesend/kyc/presentation/admin/
```

Or R5 veut le KYB **dans le core**. Trois lectures possibles, à arbitrer explicitement :

- la revue reste produit, dupliquée côté `aiglebusiness` pour le KYB ;
- la revue remonte au core, les produits n'exposant qu'une présentation mince ;
- la revue devient un service core que les deux produits appellent, chacun avec ses permissions.

C'est la vraie question d'architecture du chantier. Ne la laisse pas se décider par accident.

---

## Ce qui attend une place

- **L'onglet KYB du back-office** est déjà réservé : `2026-07-30-organisations-admin-design.md` le
  note « hors périmètre, rattaché au chantier KYB différé ».
- **R5 sera clos ou requalifié** par ce chantier — il couvre aussi la partie « palier porté par le
  compte », largement livrée. Mets sa fiche à jour à la fin.

## Conventions à respecter

- `docs/rules/2026-08-03-service-boundary-rules.md` — un service ne rend jamais un modèle à travers
  une frontière, les produits consomment le core **par service**.
- La règle de documentation : le commentaire dit ce que fait le code, sans le justifier ni renvoyer
  à un numéro de lot.
- **Les migrations sont lancées par l'utilisateur**, jamais par l'assistant.
- Baselines à ne pas dégrader : `tsc` 57 erreurs, `depcruise` 0 erreur, 584 tests passés / 5 échecs
  préexistants (Kyc ×2, ProviderErrorService, DeviceService).
