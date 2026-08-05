# Gestion des appareils business — sortir du cul-de-sac du quota

**Date** : 2026-08-04
**Statut** : livré — P1, P2 et P3
**Portée** : `products/aiglebusiness/device/`, `core/identity/device`, `core/identity/authentication`

---

## Contexte

Le login business mobile enregistre un appareil et vérifie un quota :

```ts
// device_service.ts:145 — seulement sur une NOUVELLE association
await this.ensureMaxDevicesNotReached(userId, app)
```

Le quota compte les liens `UserDevice` avec `unlinkedAt IS NULL` et statut `TRUSTED` ou `PENDING`,
**scopés par app**. Valeur : `MAX_DEVICE_CONNECTIONS` — 10 dans le `.env` courant, 5 dans
`.env.example`. Dépassement : 429 `MAX_DEVICES_CONNECTION_REACHED`, dont le message conseille de se
déconnecter d'un appareil.

Ce conseil est faux. `RevokeBusinessSessionUseCase` délègue à `UserSessionService.revoke`, qui ne
fait que supprimer le jeton :

```ts
await User.accessTokens.delete(user, owned.identifier)
```

`unlinkedAt` n'est pas touché, le statut non plus : le lien reste compté. Le seul code qui libère une
place est `RevokeDeviceUseCase`, exposé sur `DELETE mobile/devices/:id/revoke` — sous
`requireApp({ app: AppName.AIGLESEND })`. Et la liste des appareils est figée sur AigleSend :

```ts
// device_controller.ts:29
const userDevices = await this.deviceService.getActiveUserDevices(user.usersUid, AppName.AIGLESEND)
```

Un lien d'appareil `aiglebusiness` n'est donc **jamais listé nulle part**, et aucune route accessible
à un jeton business ne peut le délier. Quota business atteint = impasse, sans recours utilisateur.

---

## AP-D1 — Deux notions, deux routes

Web et mobile ne produisent pas la même chose. Le login business ignore l'appareil hors canal mobile
(`business_login.use_case.ts:68`) :

| Canal      | Lien `UserDevice` | Session (jeton) | Consomme le quota |
| ---------- | ----------------- | --------------- | ----------------- |
| **Web**    | non               | oui             | **non**           |
| **Mobile** | oui               | oui             | oui               |

Une session web n'a aucun appareil derrière elle : rien à délier, seulement un jeton à supprimer. Un
appareil mobile, lui, peut subsister **sans session** — c'est exactement le cas qui crée l'impasse.
Les deux ensembles ne se contiennent donc pas, ni dans un sens ni dans l'autre.

Deux routes, chacune avec son geste :

- `GET business/devices` — les appareils mobiles de confiance. Retirer **libère une place**.
- `GET business/auth/sessions` — les accès ouverts, web et mobile. Révoquer **déconnecte**.

Une liste unique donnerait des lignes hétérogènes dont certaines se retirent et d'autres non, sans
que rien à l'écran n'explique pourquoi. Un téléphone figure dans les deux listes — il est bien les
deux à la fois.

Les sessions portent déjà leur canal (`extractChannel(token.abilities)`) : distinguer un navigateur
d'un téléphone ne demande aucun travail supplémentaire.

---

## AP-D2 — Le retrait libère la place, la déconnexion non

Révoquer une session ne délie pas l'appareil. Se déconnecter n'est pas se retirer : l'appareil reste
de confiance, la reconnexion ne consomme pas de nouvelle place et ne déclenche pas l'alerte « nouvel
appareil ».

Fusionner les deux gestes ferait perdre la déconnexion simple — se reconnecter depuis son propre
téléphone rejouerait l'alerte à chaque fois, jusqu'à la rendre insignifiante là où elle doit
alerter.

---

## AP-D3 — L'appareil principal reste protégé

Comme dans AigleSend : 403 `E_CANNOT_REVOKE_PRIMARY_DEVICE`. Une place reste tenue à vie, sans
blocage — les autres restent libérables, et l'utilisateur ne peut pas se couper tous ses accès.

C'est une entorse assumée au « plus aucune place inlibérable » : la protection contre
l'auto-exclusion pèse plus lourd, et le cas du téléphone principal perdu relève du support, comme
aujourd'hui côté AigleSend.

---

## AP-D4 — Le produit consomme le core par un Result, jamais par le modèle

`DeviceService.getActiveUserDevices` renvoie des `UserDevice` — un modèle du core. Le produit ne peut
pas s'en servir sans violer `produit-consomme-core-par-service`.

Le service core gagne donc deux méthodes à contrat produit, dans la lignée de ce que la feature fait
déjà pour ce produit (`assertTrustedForApp`, `trustForApp` — « API PRODUIT : ne renvoie/expose pas le
modèle `UserDevice` ») : une lecture rendant un `Result` minimal, et un retrait prenant un
identifiant et ne rendant rien.

Dette relevée au passage, hors périmètre : `BusinessDeviceController.updatePushToken` reçoit déjà un
`UserDevice` de `DeviceService.updatePushToken` et lit ses champs. Depcruise ne le voit pas — le type
est inféré, aucun import de modèle — mais c'est la même classe de violation. À traiter quand la
règle sera outillée pour les types inférés.

**Trouvé pendant P1** : `isPrimary` vaut `0`/`1` à l'exécution alors que le modèle le déclare
`boolean` — Lucid ne convertit pas le `tinyint`, et TypeScript ne voit rien. Le `Result` convertit,
puisqu'il promet un booléen. La valeur brute continue en revanche de partir vers le mobile AigleSend
via `DeviceResponseDTO.is_primary`, et le cas vaut pour tout `tinyint` déclaré booléen.

**Trouvé pendant P2** : `DeviceService.revokeDevice` est codé en dur sur `AppName.AIGLESEND`. Son
seul appelant est `RevokeUserDeviceUseCase`, côté **back-office** : un gestionnaire qui révoque
l'appareil d'un utilisateur ne peut donc atteindre que sa liaison AigleSend, jamais sa liaison
business. Défaut réel, hors périmètre — il demande de décider si l'admin révoque par app ou pour
toutes.

---

## AP-D5 — Les sessions se scopent par app

`UserSessionService.listActive` liste **tous** les jetons de l'utilisateur, sans filtrer sur
`appAbility` :

```ts
const tokens = await User.accessTokens.all(user)
return tokens.map((token) => ({ … }))
```

`GET business/auth/sessions` expose donc aussi les sessions AigleSend, et `revoke` — qui ne vérifie
que la propriété par utilisateur — permet d'en supprimer une depuis l'app business. Le mécanisme
existe pourtant juste à côté : `revokeAppSessions` filtre sur `token.abilities.includes(ability)`.

`listActive` et `revoke` prennent l'app en paramètre et filtrent dessus. Une session d'une autre app
devient introuvable, donc non révocable — `SessionNotFoundException` plutôt qu'un succès silencieux
sur la mauvaise app.

Le filtre devient `appTokens(user, app)`, une seule fois pour les quatre méthodes du service.
`revokeAppSessions`, qui portait déjà ce filtre en propre, passe dessus : il n'existe plus qu'une
définition de « les jetons de cette app ».

Constaté en livrant : **aucun appelant côté aiglesend**. Les sessions ne sont exposées que par le
produit business, donc la fuite était unidirectionnelle — l'app business voyait les sessions
AigleSend, jamais l'inverse.

---

## AP-D6 — Le retrait depuis le web est le vrai chemin de secours

`businessDevice()` n'exige les en-têtes d'appareil qu'en canal mobile et ne vérifie la confiance que
là. Les deux routes sont donc accessibles depuis le web sans en-têtes.

Ce n'est pas un effet de bord à corriger, c'est le cas d'usage principal : **retirer un téléphone
perdu depuis un navigateur**. Depuis le téléphone perdu, par définition, on ne peut rien faire.

---

## Ce qui est déjà en place

- La feature `products/aiglebusiness/device/` existe, avec sa chaîne de middleware complète (canal,
  auth, app, appareil) et `PUT business/devices/push-token`. Les deux routes s'y rangent.
- `RevokeDeviceUseCase` fait déjà le bon travail — jeton supprimé, statut `REVOKED`, `unlinkedAt`
  posé, audit émis. Il ne filtre pas par app : seule l'absence de route business l'a rendu
  inatteignable.
- Le quota est déjà scopé par app : rien à changer côté comptage.
- `getActiveUserDevices(userId, app?)` accepte déjà l'app en paramètre.

---

## Découpage

| Lot    | Contenu                                                                | Dépend de |
| ------ | ---------------------------------------------------------------------- | --------- |
| **P1** | Lecture : service core à `Result` + `GET business/devices`             | —         |
| **P2** | Retrait : `DELETE business/devices/:id`, place libérée, audit          | P1        |
| **P3** | Scoping par app de `listActive` et `revoke`                            | —         |

P1 a une valeur propre avant même P2 : l'utilisateur voit enfin ce qui occupe ses places. P3 est
indépendant des deux autres et livrable dans n'importe quel ordre.

---

## Ce qu'on saura à la fin

Une place prise pourra être rendue, depuis le mobile comme depuis le web. Le message de
`MaxDevicesConnectedException` cessera de conseiller un geste sans effet — il pourra désigner
l'écran qui règle réellement le problème.

L'écran « appareils connectés » du mobile business cessera d'afficher des sessions AigleSend, et
l'app business cessera de pouvoir déconnecter un appareil AigleSend.