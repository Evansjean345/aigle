---
status: approved
etape: 6
lot: MVP clos — F1 à F5 livrés (API + espace admin). F6 et F7 reportés, voir Découpage.
derniere_maj: 2026-07-30
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
| **R-D3 — ~~Référence unique à reporter dans le motif du versement~~ → AMENDÉE le 2026-07-28, voir R-D12** | Rapprochement par montant + date + nom du marchand. | ⚠️ **Cette décision n'est plus applicable telle quelle** : elle supposait que le marchand connaisse la référence *avant* de virer, alors qu'il vire d'abord et déclare ensuite (R-D9). Conservée ici pour la trace du raisonnement, remplacée par R-D12. Texte d'origine : État de l'art : chez Stripe, Adyen, Wise, Flutterwave, le montant crédité vient d'une **source faisant foi** (compte virtuel dédié ou ligne de relevé), jamais d'une saisie. Aigle n'a ni compte virtuel par marchand ni import de relevé → la saisie humaine reste nécessaire **à court terme**, mais une référence unique (`APPRO-4F2C9K`) rend le rapprochement **déterministe** au lieu d'une recherche par montant/date, permet **plusieurs demandes simultanées** sans ambiguïté, et constitue la **brique de base** de l'automatisation : le jour où un relevé est importé (CSV puis API), seul le montant change de source. Coût quasi nul aujourd'hui. ⚠️ **Non vérifié** : ce que les banques ivoiriennes exposent (notifications, relevés API, comptes virtuels) — c'est ce qui déterminera la trajectoire d'automatisation. | 2026-07-28 |
| **R-D4 — Double validation au-delà d'un seuil configurable** | Un seul valideur quel que soit le montant ; double validation systématique. | Valider **crée de la monnaie** dans le système à partir d'une vérification humaine — le risque est proportionnel au montant. Sous le seuil : un gestionnaire suffit (fluidité du quotidien). Au-dessus : **second valideur distinct**, sur le modèle du maker-checker du paiement en masse (L2-D21). La double validation systématique est écartée : sur des petits montants répétitifs elle pousse au contournement (comptes partagés, validations de complaisance) — un contrôle qu'on subit est un contrôle qu'on neutralise. Seuil **configurable** (pas codé en dur) : il dépend du volume d'affaires et évoluera. | 2026-07-28 |

| **R-D5 — Workflow côté PRODUIT, crédit délégué au core** | Modèle + service dans `core/money/funding` (par symétrie avec `core/money/transfer`) ; portage direct du legacy. | `products/aiglebusiness/funding/` porte le workflow (modèle, service, présentations **client** + **admin**) ; le crédit passe par `WalletAdjustmentService` (core, existant). **Rien de neuf dans le core** : une demande est un **document administratif**, pas une mécanique d'argent — seul le crédit final est monétaire et il existe déjà. Le parallèle avec `core/money/transfer` est **trompeur** : celui-ci vit dans le core parce qu'il porte réservation, ledger et settlement ; ici il n'y a rien de tel. Le portage direct du legacy est écarté : il n'a **ni validation ni crédit**, c'est-à-dire précisément la moitié money-critique. ⚠️ Première feature à **traverser deux canaux** (business client + admin). | 2026-07-28 |

| **R-D6 — F1 : les données bancaires d'un canal sont IMMUABLES** | Édition avec permission dédiée + journal ; CRUD standard. | `account_identifier` (numéro Wave / IBAN) est **le numéro sur lequel des marchands envoient de l'argent** : le modifier détourne **tous les versements suivants**. C'est le vecteur d'attaque le plus direct de la feature — plus que la validation, qui est tracée. → **Aucun chemin de modification** : changer de compte = **désactiver** l'ancien + **créer** un nouveau. Le risque est *supprimé par construction* plutôt que surveillé a posteriori (un journal ne protège que si quelqu'un le lit). Restent éditables : `label`, `instructions`, `display_order`, `is_active`. **Aucune suppression physique** non plus : les demandes passées référencent leur canal — le supprimer rendrait l'historique illisible et casserait l'audit. | 2026-07-28 |

| **R-D7 — F1 admin : lecture et écriture du catalogue sont DEUX permissions** | Permission unique `collection_accounts.*` ; réutilisation de `providers.read`. | Les routes admin F1 ne portaient que le guard d'authentification : **tout admin connecté pouvait créer un compte de collecte**, et le futur valideur de F3 aurait donc pu déclarer un compte qu'il contrôle, y attirer les versements, puis valider lui-même les demandes correspondantes. Séparer `collection_accounts.read` (consulter — ce dont le valideur a besoin) de `collection_accounts.manage` (décider où arrive l'argent) est ce qui rend I3 **applicable** : sans deux slugs, le rôle « valide mais ne décide pas » est inexprimable. Réutiliser `providers.read` est écarté pour la même raison — le catalogue de collecte n'est pas un catalogue de providers, et quiconque gère les tarifs pourrait ouvrir un compte de collecte. Gate appliqué **côté API** (`middleware.permission`), le gate front n'étant qu'un confort d'affichage. Permissions semées par un seeder **autonome en `attach`** : `role_permission_seeder` fait un `sync()` qui effacerait les permissions absentes de son fichier. | 2026-07-28 |

| **R-D8 — F1 admin : rendu en TABLEAU, pas en cartes** | Grille de cartes sur le patron `pages/providers`. | Le contenu utile d'un compte de collecte est un identifiant long (un IBAN fait jusqu'à 34 caractères), un titulaire et jusqu'à 500 caractères de consignes : cela se lit en ligne. Le tableau permet en outre une colonne identifiant en monospace **copiable en un clic** — l'opérateur recopie ce numéro sur des virements, et l'identifiant n'étant plus corrigeable après création (R-D6), supprimer la recopie manuelle supprime une classe d'erreur. S'écarte de `pages/providers` mais rejoint `pages/pricings`. | 2026-07-28 |

| **R-D9 — F2 : le justificatif est OBLIGATOIRE à la déclaration** | Justificatif différable, joint avant validation ; aucun justificatif dans F2. | Le marchand **vire d'abord et déclare ensuite** : au moment où il remplit le formulaire, il a déjà son reçu en main. Rendre la pièce facultative créerait donc des demandes incomplètes sans bénéfice réel, et obligerait F3 à refuser de valider tant qu'elle manque — un état de plus pour un besoin qui n'existe pas. Création en **multipart**, preuve incluse ou rien. Conséquence directe : c'est **le justificatif, et non le motif du virement, qui est la pièce de rapprochement** (voir R-D12). Stockage via `FileStorageService.uploadFile()` (S3), déjà utilisé par le KYC — rien à construire. | 2026-07-28 |

| **R-D10 — F2 : une demande en attente s'ANNULE, elle ne se modifie pas** | Modification tant que `pending` ; immuabilité totale. | Une demande déclarée est une **affirmation datée** (« j'ai versé X sur ce compte, voici le reçu ») : la réécrire après coup effacerait ce qui a été affirmé initialement, alors que l'écart entre déclaré et vérifié est précisément la donnée que R-D2 veut rendre visible. Un montant déclaré modifiable pendant que l'admin consulte la demande n'est plus une déclaration, c'est une valeur mouvante. L'annulation, elle, laisse la demande en base avec un statut terminal : erreur de saisie = annuler + redéclarer, symétrique de R-D6 sur le catalogue. L'immuabilité totale est écartée : elle forcerait l'admin à rejeter les fautes de frappe, polluant la file de rejets et rendant le taux de rejet inexploitable comme signal. | 2026-07-28 |

| **R-D11 — F2 : un SEUL identifiant, `funding_<uuid12>`** | Deux identifiants (un opaque pour l'URL, un code court `APPRO-4F2C9K` pour les humains) ; une référence courte servant à tout. | La seule justification d'un code court était sa recopie dans le **motif du versement** — et cette justification tombe entièrement (R-D12). Reste `funding_<uuid12>`, conforme au patron `collect_` / `transfer_`, qui identifie déjà la demande. Maintenir un second identifiant unique coûterait une colonne, un index unique, un alphabet sans caractères confusables et une gestion de collision, pour un besoin de désignation orale **non avéré** : le marchand voit ses demandes dans une liste, il n'a rien à dicter. Réintroductible plus tard sans rien casser si le support le réclame. | 2026-07-28 |

| **R-D12 — Le rapprochement se fait par le JUSTIFICATIF, jamais par le motif** (remplace R-D3) | Réserver une référence avant le virement pour la citer dans le motif ; double convention. | Deux raisons cumulatives, chacune suffisante. **(1)** Le marchand vire **avant** de déclarer : la référence n'existe pas quand il remplit le motif. **(2)** La preuve est une **capture d'écran du reçu** — et pour un versement mobile money, il n'existe pas de champ motif exploitable de toute façon. Le rapprochement est donc **visuel par nature** : l'admin lit la pièce jointe. Réserver la référence avant le virement est écarté (contredit le comportement réel, crée des demandes ouvertes jamais complétées, et rendrait le justificatif à nouveau différé) ; la double convention aussi (deux règles concurrentes = personne ne sait laquelle s'applique). ⚠️ **Conséquence** : la promesse d'automatisation de R-D3 par le motif tombe — elle viendra de l'import de relevé (I2), pas du motif. | 2026-07-28 |

| **R-D13 — Les justificatifs sont stockés en PRIVÉ, sur un disque dédié, servis par URL signée** | Suivre le patron KYC (`visibility: 'public'`) ; route API authentifiée proxifiant les octets. | `config/drive.ts` déclare le disque S3 en `visibility: 'public'` : les objets sont lisibles **sans authentification** par quiconque détient l'URL, laquelle **n'expire jamais**. Un reçu de virement porte numéro de compte, montant et souvent le téléphone du marchand — pour une fintech, le propager dans ce bucket est un choix qu'on ne peut pas faire par simple cohérence avec l'existant. → **disque `s3_private` dédié** (`visibility: 'private'`), URL signée à expiration courte générée au moment de la consultation. On stocke donc **la clé de l'objet, pas l'URL** — une URL signée en base serait périmée avant d'être relue. Le disque séparé laisse le KYC intact (aucun risque de régression) et rend la migration future évidente : pointer le KYC sur le même disque. La route proxy est écartée : faire servir des octets d'image par l'API pour F2 est disproportionné. | 2026-07-28 |

| **R-D14 — Le réapprovisionnement est réservé aux organisations ENTERPRISE** | Ouvert à tous les types d'organisation ; réutilisation du middleware générique `requireEnterprise`. | Décidé le 2026-07-28. Gate posé en **middleware**, après `orgPermission` — l'appartenance passe d'abord, pour ne pas révéler le type d'une organisation à un non-membre. Trois points : **(1)** le gate couvre **aussi le catalogue F1** côté marchand, qui n'existe que pour indiquer où verser en vue d'une déclaration : l'exposer à un compte marchand qui ne pourra jamais déclarer l'inviterait à envoyer de l'argent sans moyen de le faire créditer — un piège, pas une lecture inoffensive. **(2)** Exception **dédiée** `E_FUNDING_ENTERPRISE_ONLY` plutôt que le `E_MERCHANT_NO_TEAM` du middleware générique, dont le sens (« un marchand ne gère pas d'équipe ») enverrait le support sur une fausse piste ; même raisonnement que `E_MASS_TRANSFER_ENTERPRISE_ONLY`. **(3)** Test écrit en `!== ENTERPRISE` et non `=== MARCHAND` : une organisation introuvable, ou un type ajouté plus tard à l'enum, est refusée **par défaut** plutôt qu'admise par omission. Le niveau KYB n'entre pas dans ce gate — c'est la vérification humaine de F3 qui décide de créditer. | 2026-07-28 |

| **R-D15 — Le gate ENTERPRISE est MUTUALISÉ au module business** | Une policy + un middleware par feature (l'existant) ; un seul code d'erreur générique. | Constat de l'utilisateur, 2026-07-28 : la règle était écrite **trois fois** — équipe, paiement en masse, réapprovisionnement — chacune rechargeant l'organisation et refaisant la même comparaison. « Réservé aux entreprises » est une propriété **du module**, pas de chacune de ses features. → `shared/authorization/enterprise_policy.ts` + `shared/middleware/require_enterprise_middleware.ts`, **paramétré par l'exception à lever** : chaque fonctionnalité garde son code public (`E_MERCHANT_NO_TEAM`, `E_MASS_TRANSFER_ENTERPRISE_ONLY`, `E_FUNDING_ENTERPRISE_ONLY`). Unifier les codes est écarté : aucun front du monorepo ne les consomme, mais un client hors dépôt reste possible, et le coût de les conserver est quasi nul face à celui d'un client cassé en production. ⚠️ **La duplication avait déjà produit une divergence** : `team_account_policy` testait `=== MARCHAND`, donc laissait passer une **organisation introuvable**, là où les deux autres testaient `!== ENTERPRISE` et la refusaient. L'unification retient la version restrictive — refus par défaut. Supprimés : 3 policies, 3 middlewares, 2 entrées de kernel. | 2026-07-28 |

| **R-D16 — F3 : le crédit écrit une LIGNE LEDGER sans transaction, sur le patron du hold** | Se contenter de `wallet_adjustments` ; fabriquer une `Transaction` porteuse pour satisfaire `recordAdjustment`. | Corrige l'erreur d'I1. Un réapprovisionnement validé fait **entrer de l'argent dans le système** : s'il n'apparaît nulle part au ledger, aucun rapprochement comptable ne peut le retrouver. Pire, chaque ligne du ledger porte `balanceBefore`/`balanceAfter` — un crédit absent fait **décrocher le fil du ledger du solde réel**, et toutes les lignes suivantes deviennent incohérentes avec la précédente. → `LedgerService.recordFundingCredit()`, calqué sur `recordHold` (L2-D4) : écriture directe au repository, `transaction_id = null`, nouveau `LedgerOperationType.FUNDING`. Fabriquer une `Transaction` fictive est écarté : une Transaction représente un flux traité par la plateforme (provider, statut, cycle de vie) dont rien n'existe ici — on créerait un objet mensonger pour satisfaire une signature, et il polluerait listes et statistiques. ⚠️ **`adjust()` n'est PAS modifié** : le faire changerait le comportement de tous les ajustements manuels existants. Le nouveau ledger est appelé par le use case de validation. Voir la découverte connexe ci-dessous. | 2026-07-28 |

| **R-D17 — F3 : le montant crédité est PLAFONNÉ au montant déclaré** | Montant vérifié libre (lettre de R-D2) ; tolérance bornée configurable. | R-D2 justifie l'écart entre déclaré et vérifié par les frais bancaires prélevés à l'arrivée, les arrondis et les versements partiels — **tous à la baisse**. Créditer *au-dessus* de ce que le marchand affirme lui-même avoir versé n'a aucune cause légitime connue : c'est une faute de frappe ou une fraude. Le plafond transforme les deux en **refus immédiat** au lieu d'un écart à repérer a posteriori dans une liste — et R-D2 prévenait déjà qu'un contrôle qu'on ne lit pas ne protège de rien. La tolérance bornée est écartée : elle ajoute un seuil à configurer alors que F4 en introduit déjà un, sans couvrir de cas réel identifié. | 2026-07-28 |

| **R-D18 — Un réapprovisionnement est une ENTRÉE D'ARGENT, pas un ajustement de wallet** | Passer par `WalletAdjustmentService.adjust()` avec un motif dédié (ce qui avait été implémenté) ; créer une `Transaction` porteuse. | Question posée par l'utilisateur le 2026-07-28 : *« un réapprovisionnement n'est pas un ajustement du wallet, est-ce que dans une fintech ils désignent la même chose ? »* — **non**, et le codebase le disait déjà. Un **ajustement** est une écriture *corrective* : il répare un écart entre le système et la réalité, sans événement commercial en amont (débit manquant, crédit en double, erreur système). Un **réapprovisionnement** est un flux **primaire** : de l'argent est réellement entré dans l'établissement. Trois conséquences à les confondre : (1) le **volume d'ajustements est un indicateur de santé** — y verser un flux de routine le rend illisible et permet à une vraie correction de s'y cacher ; (2) la **réconciliation entre fonds reçus et monnaie émise** devient opaque, un ajustement créditant typiquement sans contrepartie de trésorerie ; (3) les contrôles renforcés propres aux ajustements se diluent. **Preuve dans le code** : les quatre autres crédits de wallet — dépôt, transfert interne, remboursement, libération de hold — appellent `walletService.creditBalance` + leur propre ligne ledger, et **aucun** n'écrit dans `wallet_adjustments`. → Le service fait désormais comme le dépôt. Supprimés : `AdjustmentReason.FUNDING_REQUEST`, la colonne `wallet_adjustment_id`, et la migration d'ENUM qui les portait. Rien n'est perdu : `funding_requests` porte déjà montant vérifié, valideur, horodatage et motif. ⚠️ **Erreur d'analyse de ma part** : I1 répondait à « par quelle *mécanique* créditer ? », j'en ai tiré une réponse à « qu'est-ce que cet événement *est* ? ». Deux questions distinctes. | 2026-07-28 |

| **R-D19 — F5 : l'UI admin existante par organisation est SUPPRIMÉE, pas rebranchée** | Rebrancher l'onglet « Approvisionnement » du détail org sur la file globale filtrée côté client ; laisser l'onglet en mock non livré. | L'API n'expose **aucun** endpoint par organisation (`GET /organisations/:id/fundings` n'existe pas, et le mock le supposait) — seul existe une **file globale** `GET /funding-requests`. L'UI existante (`OrganisationFundingTab.vue`, page `[fundingId].vue`, `useOrganisationFundings`, `useFundingDetails`, `MOCK_FUNDINGS`, type `OrganisationFunding`, enums `FundingMethod`/`FundingStatus`) est en outre bâtie sur un **contrat incompatible** (champs `method`/`sourceLabel`/`initiatedBy`/`validatedBy`/`note` et statut `completed` vs `declaredAmount`/`collectionAccount`/`amountGap`/`documentUrl`/`reviewComment` et statut `approved`). La rebrancher demanderait soit un endpoint à créer (gonflette d'API pour un mock), soit un filtrage client (l'admin verrait la file tronquée à une org, et le bouton de détail le ferait sortir du contexte org). Laisser le mock non livré laisse du code mort qui finit induit en erreur. → on supprime l'onglet et tout le mock financement, et on construit une UI **neuve** (file globale + page détail référence) contre le vrai contrat. L'onglet disparaît du détail org : un gestionnaire voulant l'historique d'une org l'obtient en filtrant la file globale (futur) ou via le ledger. | 2026-07-29 |

### ⚠️ Découverte connexe, hors périmètre F3

Le même trou affecte les **ajustements manuels d'administration** : `POST /admin/wallets/adjustments` sans
`transactionReference` produit un mouvement de solde **sans ligne ledger**. F3 ne le corrige pas — modifier
`adjust()` changerait le comportement de tous les ajustements existants et déborde du lot. À traiter pour
soi, avec sa propre analyse d'impact sur les données déjà écrites.

| **R-D20 — F4 : le seuil de double validation porte sur le montant DÉCLARÉ** | Seuil sur le montant vérifié (celui réellement crédité) ; seuil sur le plus élevé des deux. | Règle de contrôle interne : **le déclencheur d'un contrôle ne doit pas être une valeur que la personne contrôlée peut fixer**. Le montant vérifié est saisi par le premier valideur lui-même — il lui suffirait de rester juste sous le seuil pour n'avoir jamais de second regard. Ce comportement porte un nom dans le métier, le *structuring*, et il est si documenté que le fractionnement pour rester sous un seuil de déclaration constitue une infraction en soi dans plusieurs juridictions : l'industrie a constaté que tout seuil manipulable finit manipulé. Le montant déclaré, lui, est fixé par le marchand avant que quiconque y touche. **Contrepartie assumée** : une demande déclarée à 2 M dont 100 k seulement sont arrivés mobilisera deux gestionnaires pour créditer 100 k. Ce n'est pas une friction mal placée — un écart de cette ampleur est une **exception de rapprochement** (virement rejeté, fonds partis ailleurs, déclaration fausse), donc précisément un dossier à instruire. ⚠️ **Limite du contrôle, à ne pas oublier** : le seuil ne protège que d'un valideur agissant **seul** sur un dossier légitimement gros. Il n'arrête pas la collusion : un marchand complice déclare sous le seuil, et aucune des deux variantes n'y change rien. | 2026-07-29 |

| **R-D21 — F4 : le second valideur CONFIRME ou REJETTE, il ne corrige pas** | Second valideur autorisé à ajuster le montant vérifié avant crédit. | Le premier constate le montant sur la pièce et en porte la responsabilité ; le second contrôle ce constat. S'il le juge faux, il rejette et la demande repart de zéro. Autoriser la correction rendrait la responsabilité du montant floue — qui a constaté quoi ? — et obligerait à réévaluer le seuil après modification, un montant relevé pouvant franchir un palier qui exigerait un troisième valideur. Un second regard doit rester un contrôle, pas une seconde saisie. | 2026-07-29 |

| **R-D22 — F4 : le seuil vit dans une table dédiée à colonnes typées** | Variable d'environnement ; table clef/valeur générique. | Sur le patron `kyc_level`, seul précédent du projet pour une limite métier configurable : table `funding_settings`, colonne `double_approval_threshold` typée en décimal. La variable d'environnement est écartée car « configurable » deviendrait « configurable par un redéploiement » — un responsable financier ne pourrait pas l'ajuster, et la valeur effective ne serait pas auditable depuis l'application. La table clef/valeur générique est écartée : concept neuf dans ce codebase, et une valeur monétaire y perdrait son type. ⚠️ **Seuil absent = échec explicite**, sur le patron de `AccountLimitsNotConfiguredException` : ne jamais retomber sur une valeur par défaut, qui ferait disparaître le contrôle en silence. | 2026-07-29 |

### ⚠️ Hors périmètre F4 — la revue d'écart

La pratique complète superpose **deux** contrôles : la double autorisation sur le montant instruit
(F4), **et** une revue d'exception déclenchée par l'**écart** entre déclaré et crédité au-delà d'une
proportion, quel que soit le montant. F4 ne livre que le premier. Traiter un gros écart comme une
anomalie à justifier est un chantier distinct, à ne pas glisser dans F4.

| **R-D23 — F4 livre le seuil GLOBAL ; la surcharge par organisation est REPORTÉE** | Livrer les deux d'emblée ; seuil global définitif sans surcharge possible. | Le seuil « dépend du volume d'affaires » (R-D4), donc une surcharge par organisation est bien le besoin final. Mais elle **ne change ni le flux, ni les colonnes de la demande, ni les tests du lot** : seule la résolution du seuil gagne un niveau. → F4 livre `funding_settings` (ligne unique, défaut global) et une **résolution isolée dans une seule méthode**, pour que l'ajout de la surcharge se réduise plus tard à un niveau de cascade supplémentaire. Décidé le 2026-07-29 pour livrer plus vite. ⚠️ **Seuil absent = échec explicite**, sur le patron de `AccountLimitsNotConfiguredException` : jamais de valeur de repli, qui ferait disparaître le contrôle en silence. |

### Report — surcharge du seuil par organisation *(lot F7)*

Table `organisation_funding_thresholds` (0..1 par organisation), résolution en cascade
« surcharge → global → échec », et trois endpoints (`GET`/`PUT`/`DELETE` de la surcharge).

⚠️ **À retenir pour la conception de F7** : la surcharge pourra **relever** le seuil, donc affaiblir
le contrôle pour une organisation ciblée. C'est le besoin métier, mais aussi le contournement le plus
direct — un administrateur cumulant `funding_settings.manage` et `funding_requests.review` peut poser
une surcharge élevée, valider seul un gros dossier, puis **retirer la surcharge** : la configuration
redevient normale et rien n'explique plus l'absence de second valideur.

Deux garde-fous sont **déjà en place grâce à F4**, ce qui rend F7 tenable :
- `approval_threshold_applied` est figé sur chaque demande — l'anomalie reste lisible même après
  suppression de la surcharge ;
- `funding_settings.manage` est séparée de `funding_requests.review` — poser la surcharge et valider
  ne sont pas le même droit.

## Découpage

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| **F1** | Catalogue des comptes de collecte : modèle + CRUD admin + lecture marchand | — | ✅ livré (API `9950c3c` + page admin) |
| **F2** | Déclaration marchand : `funding_request` (montant déclaré, canal, preuve) | F1 | ✅ livré côté API (8 tests verts) |
| **F3** | ⚠️ *money-critique* — Validation & crédit (`WalletAdjustmentService` CREDIT, montant vérifié, journalisation du valideur, rejet) | F2 | ✅ livré côté API (11 tests verts, TDD) |
| **F4** | Double validation au-delà du seuil configurable (R-D4) | F3 | ✅ livré (API 14 tests verts TDD + espace admin) |
| **F5** | Branchement de l'admin existant (remplace `MOCK_FUNDINGS`) + OpenAPI | F3 | ✅ F5-A livré (file + détail + revue + OpenAPI `funding.yaml`) — F5-B (per-org) supprimé (R-D19) |
| **F7** | Surcharge du seuil de double validation **par organisation** (report de R-D23) | F4 | ⏸ **version suivante** — le MVP utilise le seuil global |
| **F6** | 🔒 Migration des documents **existants** (KYC recto/verso/selfie, et tout autre upload) du disque public vers `s3_private` + URLs signées | R-D13 | ⏸ **reporté au chantier KYB** |

### Périmètre MVP — clos le 2026-07-30

F1 à F5 sont livrés, API et espace admin. Décisions de clôture prises ce jour :

- **F7 (surcharge par organisation) → version suivante.** Le MVP fonctionne avec le seul seuil
  global de `funding_settings`. `resolveThreshold()` reste le point d'extension unique : y insérer
  la surcharge ne touchera ni le flux, ni les colonnes, ni les tests. ⚠️ Relire R-D23 avant de
  l'implémenter — la surcharge peut **relever** le seuil, et c'est le contournement le plus direct
  du contrôle.
- **F6 (migration des documents existants) → chantier KYB.** Les pièces concernées sont
  majoritairement des documents KYC ; leur migration vers `s3_private` a sa place là où ces
  documents sont retravaillés. ⚠️ D'ici là, les documents KYC restent **lisibles sans
  authentification** par quiconque détient leur URL (`config/drive.ts`, disque `s3`). Les
  justificatifs de réapprovisionnement, eux, sont déjà privés.
- **Affichage du segment sur les plafonds KYC → chantier KYB.** Deux lignes « Niveau Basique /
  niveau 1 » sont aujourd'hui indiscernables dans `/settings/kyc-levels` : elles se distinguent par
  leur `segment`, absent du type front. Le tableau a la place d'une colonne ; l'ajout suppose de
  vérifier que l'API expose bien `segment` dans la réponse de liste.

**Sur F6** — décidé le 2026-07-28 : « nous sommes une fintech, nous allons aussi migrer l'existant ».
Ce n'est **pas** un sous-ensemble de F2 et ne doit pas y être absorbé : les lignes en base stockent
des **URLs publiques complètes**, pas des clés. Basculer la visibilité sans convertir conjointement
le code *et* les données casse l'affichage des documents KYC en admin. Le chantier comprend : ACL des
objets déjà déposés, conversion `url → clé` en base, adaptation des lecteurs (admin KYC, mobile), et
une stratégie de repli si la conversion échoue à mi-parcours. À concevoir pour soi.

**Principe du découpage** : F1 et F2 ne touchent **jamais** à l'argent — tout le risque est concentré
dans F3, traitable en TDD strict avec invariants explicites.

**Hors scope** (YAGNI) : import de relevé bancaire, comptes virtuels par marchand, notifications de
rappel, réapprovisionnement côté consumer.

## Inconnues

| # | Inconnue | Statut |
|---|----------|--------|
| I1 | **Par quelle primitive créditer le wallet ?** L'argent arrive **hors plateforme** (le marchand verse sur le numéro Wave ou le RIB d'Aigle) → **aucune transaction provider à régler**, donc ni `initiateExternalIn` ni `settle`. | ⚠️ **Levée, puis PARTIELLEMENT CORRIGÉE (2026-07-28, au design de F3).** `WalletAdjustmentService.adjust()` fait bien le crédit transaction-less et écrit `wallet_adjustments`. **Mais la partie « ligne ledger » était fausse** : `wallet_adjustment_service.ts:52` conditionne `recordAdjustment` à `if (params.transaction)`. Sans transaction — notre cas — **aucune ligne n'est écrite au ledger**. Voir R-D16 pour la résolution. |
| I2 | Ce que les banques ivoiriennes exposent (notifications, relevés API, comptes virtuels) — détermine la trajectoire d'automatisation (R-D3). | ⬜ à vérifier hors développement |
| I3 | Séparation des tâches : le valideur ne devrait pouvoir ni modifier le catalogue de canaux ni ajuster un wallet directement. À trancher au design des permissions. | 🟡 **à moitié levée (2026-07-28)** — volet catalogue traité par R-D7 : `collection_accounts.read` / `.manage` sont deux slugs distincts, gate appliqué côté API. Reste ouvert : l'exclusion mutuelle entre *valider une demande* (F3) et `wallet_adjustment.execute` — un valideur pouvant déjà ajuster un wallet directement n'aurait aucun besoin de passer par une demande. À trancher au design de F3. |

## Contexte complémentaire  *(2026-07-28)*

Le **catalogue** ne contient pas des « providers de paiement » mais **les comptes de collecte
d'Aigle** (numéro Wave d'entreprise, RIB). Le marchand les **consulte** pour savoir où verser, puis
effectue le versement **hors plateforme**. Aucun flux ne traverse le système — d'où I1.

## Prochaine session

**F1 est clos** : API (`9950c3c`) + page admin `/collection-accounts` dans le layer `catalog`.

⚠️ **Action utilisateur requise avant que la page soit accessible** :
`node ace db:seed --files="database/seeders/collection_account_permission_seeder.ts"`, puis attacher
`collection_accounts.read` / `.manage` aux rôles voulus. Sans cela, la page est masquée et l'API
répond 403 (sauf pour le rôle `root`, qui contourne le middleware).

**Piège rencontré, à garder en tête pour F2/F3** : `table.boolean()` produit un `tinyint(1)` que
Lucid restitue en `0`/`1`. Le DTO annonçait `isActive: boolean` mais transportait un nombre, et le
front comparant `=== true` affichait « Réactiver » sur un compte actif. Corrigé à la source par
`@column({ consume: (value) => Boolean(value) })` + test de régression sur le **type**. `funding_request`
(F2) aura des booléens et des enums : même vigilance sur ce que le DTO promet et ce qu'il transporte.

**F2 est clos côté API** (8 tests verts, migration `funding_requests` jouée, batch 18). Reste à faire
avant F3 : rien de bloquant. ⚠️ **À vérifier côté infra avant mise en service** : que la policy du
bucket S3 n'impose pas `public-read`, sinon l'écriture en `s3_private` réussit mais l'objet reste
lisible — le garde-fou de R-D13 serait illusoire.

**Reporté (décidé 2026-07-28, à traiter plus tard) — afficher l'auteur de la création d'un compte
de collecte.** R-D6 rend l'identifiant bancaire immuable parce que c'est le vecteur d'attaque le
plus direct de la feature, et R-D7 restreint qui peut en créer un ; il manque le troisième volet :
**qui l'a créé**. Sans cela, un compte de collecte frauduleux ne se rattache à personne. Chantier :
migration `created_by_admin_id` (nullable — les lignes existantes n'ont pas d'auteur), `@belongsTo`
vers `Admin` sur le modèle, capture de `auth.getUserOrFail().id` dans le contrôleur (patron déjà en
place sur `wallet_adjustments`), exposition dans la **vue admin uniquement** — jamais dans la vue
marchand — et colonne « Créé par » au tableau. ⚠️ Migration à lancer par l'utilisateur.

**Prochaine étape : brainstorming du lot F2** — déclaration marchand (`funding_request`, montant
déclaré, canal, preuve, référence unique `APPRO-XXXXXX`). Zéro argent. Questions ouvertes à traiter
au design de F2 : où stocke-t-on le justificatif (le legacy utilisait un `document_url`) ; combien de
demandes simultanées un marchand peut-il avoir ouvertes ; la référence unique est-elle générée à la
création de la demande ou réservée en amont.

## F5 — Branchement admin + OpenAPI *(conception 2026-07-29)*

### Contexte
- API admin livrée (F2/F3, non committée) et enregistrée dans `start/admin_routes.ts` sous
  `/api/admin/funding-requests` : `GET /` (file globale, filtre `?status`), `GET /:reference`,
  `POST /:reference/approve` (`{verifiedAmount, comment?}`), `POST /:reference/reject` (`{comment}`).
  Permissions `funding_requests.read` / `.review` semées par `database/seeders/funding_request_permission_seeder.ts`.
- Contrat de sortie `FundingRequestAdminView` (DTO `funding_request.dto.ts`) : `reference,
  declaredAmount, status (pending|approved|rejected), documentUrl, collectionAccount, declaredAt,
  cancelledAt, organisationId, declaredByUserId, verifiedAmount, amountGap, reviewedByAdminId,
  reviewedAt, reviewComment`.
- `AppSidebar.vue` contient déjà une entrée « Réapprovisionnement » (groupe Finances) pointant par
  défaut sur `/ledgers` (`LEDGERS_READ`) — placeholder à repointer sur la nouvelle page.
- ⚠️ **Divergence** : l'UI admin existante (`OrganisationFundingTab.vue`, `[fundingId].vue`,
  `organisations.service.ts`, `useOrganisationFundings.ts`, `useFundingDetails.ts`, mock
  `MOCK_FUNDINGS`) est bâtie sur le type mock `OrganisationFunding` et suppose des endpoints
  `GET /organisations/:id/fundings[/:fundingId]` + `PUT .../validate|reject` **qui n'existent pas**.
  Champs incompatibles (`method`/`sourceLabel`/`initiatedBy`/`validatedBy`/`currency`/`note` vs
  `declaredAmount`/`collectionAccount`/`amountGap`/`documentUrl`/`reviewComment`) et statut `completed`
  vs `approved`. L'API n'expose qu'une file **globale**, pas par organisation.
- OpenAPI : `config/swagger.ts` `adminOptions` charge une liste de yaml (admin-auth, wallets,
  catalogs, transactions, …). F1 a documenté les comptes de collecte admin dans `catalogs.yaml`
  (tag `Admin`) — même patron à suivre pour `funding-requests`.
- Patron front : layer `catalog` (service `useFetchApi`, `pages/.../index.vue`, fichier
  `permissions`, table) — à répliquer pour un layer `funding`.

### Décision de périmètre
Sous-lot F5-A : **file globale + page détail référence + actions valider/rejeter** en un lot
(décidé 2026-07-29). Voir R-D19 pour la suppression de l'UI par organisation.

### Approche retenue
Nouveau layer admin `app/layers/funding/` calqué sur `catalog`, construit **directement contre
le contrat API réel** (`FundingRequestAdminView`), sans réutiliser le mock. File globale +
page détail adressée par `reference` (patron API) + actions de revue. OpenAPI : documenter les
4 endpoints admin dans un nouveau `docs/swagger/funding.yaml` chargé par `adminOptions`, tag
`Admin` (suivre le patron F1).

### Architecture
Nouveau layer `app/layers/funding/` :
- `permissions.ts` — `FundingPermissions.READ = 'funding_requests.read'`, `REVIEW = 'funding_requests.review'` (slugs alignés sur le seeder API).
- `type.ts` — `FundingRequestStatus` enum (`pending|approved|rejected`), interface `FundingRequestAdminView` miroir du DTO, `FundingReviewAction`.
- `services/funding.service.ts` — `getFundingRequests(status?)` (GET `/funding-requests`), `getFundingRequest(reference)` (GET `/:reference`), `approveFundingRequest(reference, {verifiedAmount, comment?})` (POST `/:reference/approve`), `rejectFundingRequest(reference, comment)` (POST `/:reference/reject`), via `useFetchApi`.
- `utils.ts` + `components/shared/badge-variants.ts` — `getFundingStatusLabel`, `fundingStatusBadge`.
- `pages/funding-requests/index.vue` — file globale : table + filtre statut (Toutes / En attente / Validées / Rejetées), `definePageMeta` perm `READ`, `middleware:["auth","permission"]`.
- `pages/funding-requests/[reference].vue` — détail : justificatif (`documentUrl`, URL signée, ouverture nouvel onglet), compte de collecte visé, montants déclaré/vérifié, écart, statut, timeline, formulaire de revue (valider: `verifiedAmount` plafonné au déclaré + `comment?` ; rejeter: `comment` ≥ 3). Perm `READ` ; boutons de revue gated par `can(REVIEW)`.
- `components/FundingRequestsTable.vue`, `components/ReviewFundingDialog.vue`.

### Impact sur l'existant (suppressions, R-D19)
- **Supprimés** : `components/funding/OrganisationFundingTab.vue`, `composables/useOrganisationFundings.ts`, `composables/useFundingDetails.ts`, `pages/organisations/[id]/fundings/[fundingId].vue` (+ dir `fundings/`).
- **Modifiés** : `pages/organisations/[id]/index.vue` (retirer l'onglet `funding` : `TABS`, `TabsTrigger`, `TabsContent`, import) ; `mocks/organisations.mock.ts` (bloque `MOCK_FUNDINGS` + imports) ; `services/organisations.service.ts` (4 méthodes financement + imports) ; `type.ts` (enums `FundingMethod`/`FundingStatus`, interface `OrganisationFunding`) ; `utils.ts` (`getFundingMethodLabel`, `getFundingStatusLabel`) ; `components/shared/badge-variants.ts` (`fundingStatusBadge`).
- **Sidebar** `AppSidebar.vue` : repointer l'entrée « Réapprovisionnement » sur `/funding-requests`, perm `FundingPermissions.READ`, icône `ArrowDownToLine` (supprimer le doublon pointant sur `/ledgers`).
- Risque : le détail org perd son onglet Approvisionnement (accepté, R-D19) ; les autres onglets sont inchangés. Références aux symboles supprimés déjà vérifiées (8 fichiers, tous dans le layer `organisation` + sidebar).

### Flux de données
- File : `useAsyncData` → `funding.service.getFundingRequests(status)` → `GET /api/admin/funding-requests?status=` → `{data: FundingRequestAdminView[]}`. Filtre statut côté serveur ; tri « plus ancien d'abord » garanti par l'API.
- Détail : `getFundingRequest(reference)` → `GET /api/admin/funding-requests/:reference`.
- Revue : `POST /:reference/approve` `{verifiedAmount, comment?}` ou `POST /:reference/reject` `{comment}` ; rafraîchir le détail (et la file au retour).
- `documentUrl` : URL signée à expiration courte, générée à la volée par l'API → ouvrir dans un nouvel onglet, ne pas mettre en cache.

### Gestion des erreurs
- 403 `funding_requests.read` / `.review` : middleware de permission masque la page ; boutons de revue gated par `can(REVIEW)`.
- Approuver : `verifiedAmount > declaredAmount` → `VerifiedAmountExceedsDeclaredException` (toast) ; déjà traitée → `FundingRequestNotReviewableException` (toast + refresh) ; montant invalide → `InvalidVerifiedAmountException`. Le plafond `verifiedAmount ≤ declaredAmount` est aussi bloqué côté front (input `max`).
- Rejeter : `comment` vide → `InvalidReviewCommentException` ; validation client `minLength(3)` avant l'envoi.
- Détail introuvable → `FundingRequestNotFoundException` → page « introuvable ».
- Messages mappés depuis `error.response._data.message` (patron existant `notifyError`).

### Tests
- Aucun nouveau test API : les 4 endpoints sont déjà couverts par `tests/functional/business/funding_requests.spec.ts` et `funding_request_review.spec.ts`. Vérifier que la baseline API (295/296 tests, 74 erreurs TS) **ne régresse pas** — ce lot ne touche que l'admin front (projet TS séparé) et l'OpenAPI yaml.
- Front admin : pas d'infra de test ; vérification visuelle (file, filtre, détail, valider/rejeter, états vide/erreur).

### Risques & inconnues
- **I-F5-1 ✅ levée (2026-07-29)** : `declaredByUserId` (UUID) et `reviewedByAdminId` (nombre) sont des **IDs, pas des noms** — le mock affichait des noms. **Décision : IDs bruts pour ce lot** — `organisationId` affiché en lien vers `/organisations/:id`, IDs déclarant/valideur présentés en monospace. L'enrichissement du DTO avec noms (user/admin) est différé à un lot ultérieur (évolution API, migration nulle).
- **I-F5-2** : placement OpenAPI — nouveau `funding.yaml` (propre, séparation domaine) vs réutilisation de `catalogs.yaml` (F1). Recommandé : nouveau `funding.yaml` enregistré dans `adminOptions` (et `aiglesendOptions` pour les endpoints client F2). À confirmer au passage `api-docs`.
- **I-F5-3** : `documentUrl` signée — vérifier côté infra que le bucket `s3_private` n'impose pas `public-read` (déjà noté pour F2).
- ⚠️ **Action utilisateur** avant mise en service : `node ace db:seed --files="database/seeders/funding_request_permission_seeder.ts"` puis attacher `funding_requests.read` / `.review` aux rôles (le `.review` ne doit pas cohabiter avec `wallet_adjustment.execute`).
