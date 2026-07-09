---
type: backlog
description: Remarques / observations à brainstormer et corriger plus tard (ne pas traiter à la volée)
derniere_maj: 2026-07-09
---

# Remarques à brainstormer

Backlog des observations soulevées en cours de route mais **volontairement différées** : chacune
mérite un vrai passage par le skill brainstorming (design + décisions) avant correction. Ne pas les
corriger à la volée.

## Niveaux de criticité

Chaque remarque porte un **niveau** — il pilote la priorité de brainstorming/correction :

| Niveau | Sens | Priorité |
|--------|------|----------|
| 🔴 **Critique** | Faille de sécurité, intégrité financière, perte/corruption de données, contournement de contrôle d'accès. **Bloquant avant prod.** | Brainstormer en priorité |
| 🟠 **Majeur** | Défaut d'architecture à fort impact (couplage structurel, invariant manquant), bug fonctionnel important, dette qui s'aggrave. | À planifier |
| 🟡 **Mineur** | Incohérence, dette localisée, amélioration de lisibilité/maintenabilité sans risque. | Opportuniste |
| 🔵 **Idée** | Piste d'amélioration / évolution produit, non urgent. | Quand pertinent |

## Format

Chaque remarque : un niveau, un titre, la date, le contexte (où/quoi), pourquoi c'est différé, l'impact.

| # | Niveau | Statut | Remarque |
|---|--------|--------|----------|
| R1 | 🔴 Critique | à brainstormer | Permissions du RBAC **team** créées en CRUD par l'admin au lieu d'être **déclarées en code** par chaque feature — faille de sécurité (contrôle d'accès orphelin / privilege escalation) |

---

## Remarques

### R1 — Permissions team CRUD par l'admin au lieu d'être déclarées en code
- **Niveau** : 🔴 Critique (sécurité — contrôle d'accès back-office)
- **Date** : 2026-07-09
- **Contexte** : RBAC back-office `app/core/team/` — `application/use_cases/permissions/{create,update,delete}_permission_use_case`, `presentation/controllers/permission_management_controller.ts`, validators `permission_validator.ts`, table `permissions` (migration `create_roles_permissions_tables`).
- **Observation** : les permissions du back-office sont **CRUD à l'exécution par l'admin** (créer/modifier/supprimer une permission via l'API). Or une permission est un **point d'ancrage de code** : elle n'a de sens que si une feature la vérifie (`can('x')`). Elles devraient donc être **déclarées en code**, chaque feature **émettant ses propres permissions** (catalogue figé), l'admin ne composant que des **rôles** à partir de ce catalogue.
- **Faille de sécurité** :
  - Un admin peut **créer une permission fantôme** (aucun endpoint ne la vérifie → faux sentiment de contrôle) ou **supprimer/renommer** une permission réellement utilisée → un contrôle d'accès en code se retrouve **sans permission correspondante** (gate qui échoue ouvert ou ferme selon l'implémentation).
  - **Dérive silencieuse** entre le code (`can('kyc:approve')`) et la table (slug modifié) → contrôles contournables ou cassés, non détectables statiquement.
  - Surface d'attaque : la gestion des permissions devient un vecteur de **privilege escalation** (forger un slug attendu ailleurs).
- **Le bon pattern existe déjà côté business** : `app/products/aiglebusiness/membership/domain/permissions.config.ts` = catalogue **en code** (`BUSINESS_PERMISSIONS`, `sensitive`, `isValidPermissionSlug`), l'org ne compose que des **rôles**. Cf. [[bounded-contexts-core]]. Le RBAC team fait l'**inverse** → incohérence + faille.
- **Piste (à brainstormer, pas à figer)** : catalogue de permissions team **en code** (chaque feature/back-office déclare ses slugs, comme le business) ; retirer le CRUD de permissions ; garder le CRUD de **rôles** (composés depuis le catalogue) ; migration : seeder/valider les permissions existantes contre le catalogue, gérer les slugs orphelins.
- **Pourquoi différé** : touche le RBAC back-office **en production** (rôles/permissions admin existants) → nécessite un design de migration (compat, seed, slugs orphelins) + validation ; hors du fil en cours (auth multi-app / Lot D).
- **Impact pressenti** : **fort** (sécurité : contrôle d'accès back-office ; cohérence d'architecture RBAC code-first).
- **Statut** : à brainstormer

<!-- Modèle pour une nouvelle remarque :

### R<n> — <titre court>
- **Niveau** : 🔴 Critique | 🟠 Majeur | 🟡 Mineur | 🔵 Idée  (+ courte justification)
- **Date** : YYYY-MM-DD
- **Contexte** : <où c'est apparu, fichiers/zone concernés>
- **Observation** : <ce qui a été remarqué>
- **Pourquoi différé** : <raison de ne pas traiter maintenant>
- **Impact pressenti** : <faible / moyen / fort — et sur quoi>
- **Statut** : à brainstormer

Puis ajouter la ligne dans la table récap en tête (# | Niveau | Statut | Remarque).
-->
