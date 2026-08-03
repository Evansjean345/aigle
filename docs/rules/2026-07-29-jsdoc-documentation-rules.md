# Documentation du code (JSDoc) — Rules

**Date** : 2026-07-29
**Statut** : Validé
**Scope** : tout le code TypeScript — `app/`, `database/`, `config/`, `start/`, `tests/`

---

## Principe fondateur

> Un commentaire explique **ce que fait** le code. Le **pourquoi** d'une décision de conception vit
> dans `docs/plans/`, pas dans le fichier source.

Quelqu'un qui ouvre un fichier veut comprendre le code qu'il a sous les yeux. Un commentaire qui
déroule les alternatives écartées et renvoie à un registre de décisions le force à lire une
argumentation pour trouver une information d'usage.

---

## Règle 1 — Le format est du JSDoc typé

Une phrase qui dit ce que fait la classe ou la méthode, suivie des annotations.

```ts
/**
 * Débite le solde d'un wallet.
 *
 * @param {number} walletId - Identifiant du wallet à débiter.
 * @param {number} amount - Montant à débiter. Doit être strictement positif.
 * @param {TransactionClientContract} [trx] - Transaction optionnelle.
 * @returns {Promise<Wallet | null>} Le wallet mis à jour, ou `null` si la garde a refusé.
 * @throws {InvalidAmountException} Montant nul ou négatif.
 */
```

Le type entre accolades, le nom, un tiret, la description. Les paramètres optionnels entre
crochets : `[trx]`.

---

## Règle 2 — Toutes les données utiles sont annotées

Sur une méthode publique ou protégée :

| Annotation | Quand |
|---|---|
| `@param {Type} nom - …` | chaque argument, sans exception |
| `@returns {Type} …` | dès que la méthode renvoie autre chose que `void` |
| `@throws {Exception} …` | chaque exception que la méthode peut lever, y compris celles remontées par un appel interne dont l'appelant doit avoir connaissance |

Une méthode privée triviale peut se contenter de la phrase de description.

---

## Règle 3 — Aucune référence à une décision de conception dans le code

Interdit dans les sources : `R-D1`, `L2-D23`, `I3`, `(F1)`, `(Lot 5)` et toute autre référence à un
registre de décisions ou à un découpage de lots.

```ts
// ❌
/** Identifiant immuable (R-D6) — le modifier détournerait les versements (voir F1). */

// ✅
/** Identifiant bancaire. Immuable après création : changer de compte suppose d'en créer un autre. */
```

Ces références vieillissent mal — un lot est livré, un design est amendé — et un lecteur du code n'a
aucun moyen de les résoudre sans ouvrir un autre document.

---

## Règle 4 — Un avertissement seulement pour une contrainte non évidente

Une ligne suffit, et seulement quand un lecteur risque de casser une invariante sans s'en rendre
compte.

```ts
/**
 * Charge une demande sous verrou exclusif (`SELECT … FOR UPDATE`).
 *
 * La transaction est obligatoire : un verrou posé hors transaction est sans effet.
 */
```

Pas de déroulé des alternatives, pas de justification longue. Si le raisonnement mérite d'être
conservé, sa place est dans le document de design de la feature.

---

## Règle 5 — Pas de narration ni d'historique

Le code décrit son état actuel, pas son évolution.

```ts
// ❌ « Cette méthode existe parce que adjust() ne journalisait pas… »
// ❌ « Avant on passait par un ajustement, maintenant… »
// ✅ « Écrit la ligne d'un réapprovisionnement validé : un crédit sans transaction. »
```

L'historique est dans git et dans `docs/plans/`.

---

## Où va le reste

| Contenu | Emplacement |
|---|---|
| Ce que fait le code | JSDoc, dans le fichier |
| Contrainte non évidente à ne pas casser | une ligne de JSDoc |
| Pourquoi ce choix, alternatives écartées | `docs/plans/{date}-{sujet}-design.md` |
| Convention transverse | `docs/rules/` |
| Contrat HTTP | `docs/swagger/*.yaml` |
