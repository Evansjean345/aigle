---
status: draft
etape: 2
lot: -
derniere_maj: 2026-07-28
---

# Demande de réapprovisionnement (organisation)

Permettre à une organisation de **créditer le wallet de son compte** à partir de fonds versés à Aigle,
et à un administrateur de **valider** ce versement.

**Mode** : Moyen-à-Large — le point d'aboutissement est un **crédit de wallet** (argent entrant), donc
money-critique ; s'y ajoutent un workflow de validation, une pièce jointe (justificatif) et une
migration depuis un existant legacy.

## Contexte  *(exploré 2026-07-28)*

La feature existe **en morceaux**, et le trou est au milieu.

### 1. Legacy — `apps/aiglebusiness/client-api` (côté marchand, complet)
`ProvisionRequest` : `payment_provider_reference`, `user_id`, `organisation_id`, `amount`,
**`document_url`** (justificatif), `provision_type` (`principal` | `airtime`), `status`
(`pending` | `complete` | `rejected`).
Service : `createProvisionRequest`, `getAllProvisionRequest`, `findProvisionRequest`,
`deleteProvisionRequest`. Routes sous `provision`.

⚠️ **Aucune validation, aucun crédit de wallet** dans le legacy : le marchand *déclare*, rien
n'aboutit automatiquement. Le côté « valider et créditer » est donc **neuf**.

### 2. Admin nouveau — `apps/aiglesend/admin` (UI faite, sur des mocks)
`OrganisationFundingTab.vue` + `useOrganisationFundings` : liste, **valider**, **rejeter**
(toast « Approvisionnement validé — wallet crédité »). `organisations.service.ts` renvoie
`MOCK_FUNDINGS` — le contrat d'API est **documenté en commentaires** mais **non implémenté** :
`GET /organisations/:id/fundings`, `GET …/fundings/:fundingId`, validate, reject.

### 3. API nouvelle — `apps/aiglesend/api`
**Rien**, sauf la permission `provision:request` (« Demander un approvisionnement ») déjà déclarée
dans `permissions.config.ts`. Aucun modèle, aucune route, aucun service.

### Conséquence
Ce n'est **ni** une création pure **ni** un simple portage : c'est un **portage du côté marchand** +
une **conception neuve du côté validation/crédit**, cette dernière étant la partie money-critique.

## Décisions
| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|
| **R-D1 — Réconciliation manuelle sur un CATALOGUE de canaux configurable** | Canal automatique (mobile money/carte via provider) ; virement bancaire seul, codé en dur. | L'argent arrive **hors système** : le marchand verse sur un canal Aigle (compte bancaire, numéro mobile money, agence…), puis **déclare** le versement depuis son dashboard — il **choisit le canal**, **téléverse la preuve** et **saisit le montant**. Un admin rapproche et valide → crédit du wallet. Les canaux sont un **catalogue administrable** (créés/désactivés côté admin), pas une liste figée : Aigle peut ouvrir un nouveau compte de collecte sans redéploiement. Rejoint le legacy, dont `ProvisionRequest.payment_provider_reference` pointait déjà un canal. **Aucune intégration provider** dans ce lot : pas de webhook, pas de `external_in`. | 2026-07-28 |
| **R-D2 — Le montant CRÉDITÉ est celui vérifié par le gestionnaire, pas le montant déclaré** | Tout ou rien (rejeter si écart) ; validation partielle avec solde restant. | Le montant saisi par le marchand est une **déclaration non vérifiée** ; la vérité est le versement réel. Les écarts sont le **cas courant** (frais bancaires prélevés à l'arrivée, arrondis, versement partiel), pas l'exception : rejeter pour 500 F obligerait à tout refaire et pousserait, à l'usage, à valider « à peu près » — un contrôle contourné par fatigue est pire qu'un contrôle explicite. On stocke donc **les deux** montants. ⚠️ **Contrepartie non négociable** (sinon préférer le tout-ou-rien) : (1) montant déclaré **et** crédité persistés, l'écart devient une donnée ; (2) **identité du validateur** journalisée ; (3) écart **visible en liste admin** — un validateur créditant systématiquement au-dessus doit sauter aux yeux. La validation partielle est écartée : personne ne « complète » un virement contre la même demande, et c'est un état de plus sur un flux d'argent. | 2026-07-28 |
| **R-D3 — Référence unique par demande, à reporter dans le motif du versement** | Rapprochement par montant + date + nom du marchand. | État de l'art : chez Stripe, Adyen, Wise, Flutterwave, le montant crédité vient d'une **source faisant foi** (compte virtuel dédié ou ligne de relevé), jamais d'une saisie. Aigle n'a ni compte virtuel par marchand ni import de relevé → la saisie humaine reste nécessaire **à court terme**, mais une référence unique (`APPRO-4F2C9K`) rend le rapprochement **déterministe** au lieu d'une recherche par montant/date, permet **plusieurs demandes simultanées** sans ambiguïté, et constitue la **brique de base** de l'automatisation : le jour où un relevé est importé (CSV puis API), seul le montant change de source. Coût quasi nul aujourd'hui. ⚠️ **Non vérifié** : ce que les banques ivoiriennes exposent (notifications, relevés API, comptes virtuels) — c'est ce qui déterminera la trajectoire d'automatisation. | 2026-07-28 |
| **R-D4 — Double validation au-delà d'un seuil configurable** | Un seul valideur quel que soit le montant ; double validation systématique. | Valider **crée de la monnaie** dans le système à partir d'une vérification humaine — le risque est proportionnel au montant. Sous le seuil : un gestionnaire suffit (fluidité du quotidien). Au-dessus : **second valideur distinct**, sur le modèle du maker-checker du paiement en masse (L2-D21). La double validation systématique est écartée : sur des petits montants répétitifs elle pousse au contournement (comptes partagés, validations de complaisance) — un contrôle qu'on subit est un contrôle qu'on neutralise. Seuil **configurable** (pas codé en dur) : il dépend du volume d'affaires et évoluera. | 2026-07-28 |

| **R-D5 — Workflow côté PRODUIT, crédit délégué au core** | Modèle + service dans `core/money/funding` (par symétrie avec `core/money/transfer`) ; portage direct du legacy. | `products/aiglebusiness/funding/` porte le workflow (modèle, service, présentations **client** + **admin**) ; le crédit passe par `WalletAdjustmentService` (core, existant). **Rien de neuf dans le core** : une demande est un **document administratif**, pas une mécanique d'argent — seul le crédit final est monétaire et il existe déjà. Le parallèle avec `core/money/transfer` est **trompeur** : celui-ci vit dans le core parce qu'il porte réservation, ledger et settlement ; ici il n'y a rien de tel. Le portage direct du legacy est écarté : il n'a **ni validation ni crédit**, c'est-à-dire précisément la moitié money-critique. ⚠️ Première feature à **traverser deux canaux** (business client + admin). | 2026-07-28 |

| **R-D6 — F1 : les données bancaires d'un canal sont IMMUABLES** | Édition avec permission dédiée + journal ; CRUD standard. | `account_identifier` (numéro Wave / IBAN) est **le numéro sur lequel des marchands envoient de l'argent** : le modifier détourne **tous les versements suivants**. C'est le vecteur d'attaque le plus direct de la feature — plus que la validation, qui est tracée. → **Aucun chemin de modification** : changer de compte = **désactiver** l'ancien + **créer** un nouveau. Le risque est *supprimé par construction* plutôt que surveillé a posteriori (un journal ne protège que si quelqu'un le lit). Restent éditables : `label`, `instructions`, `display_order`, `is_active`. **Aucune suppression physique** non plus : les demandes passées référencent leur canal — le supprimer rendrait l'historique illisible et casserait l'audit. | 2026-07-28 |

## Découpage

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| **F1** | Catalogue des comptes de collecte : modèle + CRUD admin + lecture marchand | — | design en cours |
| **F2** | Déclaration marchand : `funding_request` (montant déclaré, canal, preuve, référence unique) | F1 | à faire |
| **F3** | ⚠️ *money-critique* — Validation & crédit (`WalletAdjustmentService` CREDIT, montant vérifié, journalisation du valideur, rejet) | F2 | à faire |
| **F4** | Double validation au-delà du seuil configurable (R-D4) | F3 | à faire |
| **F5** | Branchement de l'admin existant (remplace `MOCK_FUNDINGS`) + OpenAPI | F3 | à faire |

**Principe du découpage** : F1 et F2 ne touchent **jamais** à l'argent — tout le risque est concentré
dans F3, traitable en TDD strict avec invariants explicites.

**Hors scope** (YAGNI) : import de relevé bancaire, comptes virtuels par marchand, notifications de
rappel, réapprovisionnement côté consumer.

## Inconnues

| # | Inconnue | Statut |
|---|----------|--------|
| I1 | **Par quelle primitive créditer le wallet ?** L'argent arrive **hors plateforme** (le marchand verse sur le numéro Wave ou le RIB d'Aigle) → **aucune transaction provider à régler**, donc ni `initiateExternalIn` ni `settle`. | ✅ **Levée (2026-07-28)** : `WalletAdjustmentService.adjust()` existe et fait exactement cela — crédit/débit **transaction-less** (`transactionId` nullable), **ligne ledger** + enregistrement `wallet_adjustments` avec motif. Même patron que le hold du mass-transfer. Le réapprovisionnement validé = **ajustement CREDIT motivé par une demande validée**. Pas de primitive à créer. |
| I2 | Ce que les banques ivoiriennes exposent (notifications, relevés API, comptes virtuels) — détermine la trajectoire d'automatisation (R-D3). | ⬜ à vérifier hors développement |
| I3 | Séparation des tâches : le valideur ne devrait pouvoir ni modifier le catalogue de canaux ni ajuster un wallet directement. À trancher au design des permissions. | ⬜ ouverte |

## Contexte complémentaire  *(2026-07-28)*

Le **catalogue** ne contient pas des « providers de paiement » mais **les comptes de collecte
d'Aigle** (numéro Wave d'entreprise, RIB). Le marchand les **consulte** pour savoir où verser, puis
effectue le versement **hors plateforme**. Aucun flux ne traverse le système — d'où I1.

## Prochaine session
Étape 2 en cours (clarifier l'objectif). Première question posée : quels **canaux**
d'approvisionnement couvre la feature (virement bancaire déclaré vs canaux automatiques) — c'est ce
qui détermine si l'on construit un **workflow de réconciliation manuelle** ou un **flux de paiement**.
