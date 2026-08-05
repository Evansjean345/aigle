# Identité d'appareil — cesser de confondre un modèle avec un appareil

**Date** : 2026-08-05
**Statut** : approuvé — I1, I2 et I3 livrés
**Portée** : `core/identity/device`, `mobile/aiglesend`, `mobile/aiglebusiness`

---

## Contexte

Les deux applications calculent leur empreinte d'appareil avec le même code :

```ts
// deviceInfoService.ts — « This hash is stable and identifies the physical device »
let deviceInstanceId = ''
if (process.env.EXPO_OS === 'android') {
  deviceInstanceId = Application.getAndroidId() || ''
} else if (process.env.EXPO_OS === 'ios') {
  deviceInstanceId = (await Application.getIosIdForVendorAsync()) || ''
}

const fingerprintData = [
  deviceInstanceId,
  Device.brand || '', Device.modelName || '', Device.deviceType?.toString() || '',
  Device.manufacturer || '', process.env.EXPO_OS, Application.applicationId || '',
].join('|')
```

Le commentaire annonce un identifiant d'appareil physique. Ce n'en est un que si
`deviceInstanceId` est renseigné. Le `|| ''` l'avale en silence quand il ne l'est pas — et il ne
reste alors que marque, modèle, type, fabricant, OS et bundle, c'est-à-dire des valeurs **identiques
pour tous les exemplaires d'un même modèle**. L'empreinte cesse d'identifier un appareil pour
identifier un modèle.

Deux conséquences observées, de gravité très différente.

**La collision (constatée en production).** Deux Galaxy S26 distincts ont produit la même empreinte
et se sont retrouvés sur la même ligne `devices`. Le serveur n'y résiste pas :

```ts
Device.updateOrCreate({ fingerprintHash }, payload) // payload contient deviceUid
```

La clé de recherche est l'empreinte **seule**. Le second appareil écrase donc le `device_uid` du
premier ; au retour du premier, `assertTrustedForApp` compare et rejette — l'utilisateur légitime
est éjecté de son propre téléphone, et les liaisons des deux comptes pointent la même ligne. C'est
le « deux utilisateurs partageaient le même appareil ».

**La séparation inter-app (par construction).** `Application.applicationId` entre dans le hachage, et
les bundles diffèrent — `com.aigle.aiglesend` contre `com.aiglebusiness.app`. Le `device_uid`,
lui, est un UUID aléatoire en SecureStore, cloisonné par app. Un même téléphone produit donc deux
lignes `devices`, une par application. Vérifié en base : le même iPhone 12 y figure deux fois,
empreintes et uid différents, et **aucune** ligne `devices` ne porte plus d'une liaison pour un même
utilisateur — le cas « une liaison par app sur un même appareil » n'existe pas en pratique.

---

## ID-D1 — L'absence d'identité ne se représente jamais comme une identité partagée

Tout le défaut tient là. Quand le système ne sait pas quel appareil il a devant lui, il répond
« c'est un S26 » au lieu de « je ne sais pas ». Le repli est silencieux, et il pointe vers une valeur
**commune** au lieu d'une valeur **unique**.

La règle : à défaut d'identifiant d'appareil, on se replie sur quelque chose d'unique — jamais sur
des attributs de modèle. Un doublon se corrige plus tard ; une fusion, non : elle éjecte un
utilisateur légitime et fabrique un faux signal de partage d'appareil.

---

## ID-D2 — Trois valeurs, trois métiers

Deux valeurs se partagent aujourd'hui trois responsabilités. Il en faut trois, nommées :

| Valeur         | Portée                            | Survit à la réinstallation | Rôle                                            |
| -------------- | --------------------------------- | -------------------------- | ----------------------------------------------- |
| `install_id`   | une installation                  | non                        | credential — la requête vient bien de cette install |
| `device_ref`   | un appareil × une app             | oui                        | reconnaître le retour d'un appareil déjà vu     |
| `hardware_key` | un appareil, toutes nos apps      | oui                        | corrélation inter-app, détection de partage     |

- `install_id` — `Crypto.randomUUID()` en SecureStore. C'est l'actuel `device_uid`, et il est déjà
  correct : aléatoire, donc **hors de portée de toute collision**.
- `hardware_key` — `identifierForVendor` sur iOS, **App Set ID** (`SCOPE_DEVELOPER`) sur Android.
  Nullable : il peut manquer.
- `device_ref` — `SHA256(hardware_key ‖ applicationId)`. Ce que l'empreinte actuelle essaie d'être,
  mais dérivé **uniquement** d'une valeur unique par appareil.

`device_ref` reste cloisonné par app, et c'est voulu : c'est le credential stable, une app compromise
ne doit pas emporter l'autre. La corrélation passe par `hardware_key`, qui ne l'est pas. Les deux
rôles que l'empreinte cumulait sont enfin séparés.

---

## ID-D3 — L'identité faible est un état déclaré, pas un accident

Quand `hardware_key` est indisponible — pas de services Google Play, IDFV non encore résolu — la
liaison se déclare telle quelle : `device_ref` nul, identité `weak`, et l'appareil n'est plus
identifié que par son `install_id`.

Ce que ça implique, assumé :

- il ne se confond avec rien, un identifiant aléatoire ne collisionnant pas ;
- il ne survivra pas à une réinstallation, et on l'accepte ;
- le back-office l'affiche comme tel et peut le traiter en suspect, au lieu de le croire.

C'est le pendant direct d'ID-D1 : l'ignorance devient une information, au lieu d'être maquillée en
certitude.

---

## ID-D4 — Une empreinte réclamée par deux installations est un incident, pas une mise à jour

Même avec un client corrigé, le serveur ne doit plus jamais laisser une empreinte écraser un
`install_id`. La recherche se fait par `device_ref` ; si la ligne existe et que son `install_id`
diffère, on ne met **pas** à jour : on crée une ligne distincte et on journalise la collision.

Une empreinte revendiquée par deux installations est soit un défaut client, soit une tentative
d'usurpation. Dans les deux cas ça se trace, ça ne s'absorbe pas.

C'est le garde-fou qui aurait suffi à éviter le cas S26 **sans toucher au mobile** — raison pour
laquelle il part en premier lot.

---

## ID-D5 — La correction de collision ne dépend pas de la corrélation

Deux chantiers de nature différente vivent dans ce design, et ils ne doivent pas s'attendre :

- **l'anti-collision** est une correction de bug, d'effet immédiat, sans prérequis externe ;
- **la corrélation inter-app** est une amélioration produit, et elle dépend de faits que le code ne
  détient pas : les deux applications doivent être publiées sous le **même compte Apple** et le
  **même compte Play**. Sinon ni l'IDFV ni l'App Set ID ne se corrèlent, et il faut se tourner vers
  un moteur probabiliste — donc un prestataire.

À vérifier avant d'engager la corrélation, pas avant l'anti-collision.

---

## Ce qui est déjà en place

- `device_uid` est déjà un UUID aléatoire : le socle non collisionnable existe, il est simplement
  doublé par une empreinte qui, elle, collisionne.
- La colonne `user_devices.app` et son affichage back-office distinguent déjà les applications ; ce
  chantier ajoute de quoi les **regrouper**, ce que le badge ne peut pas faire seul.
- `getAllUsersByDeviceId` et l'écran « comptes associés » existent : ils attendent une clé qui
  traverse les apps pour devenir utiles.
- Aucun appareil de la base ne porte aujourd'hui plus d'un utilisateur distinct — le passif est
  propre, la correction n'a pas de rattrapage lourd à faire.

---

## Découpage

| Lot     | Contenu                                                                        | Dépend de |
| ------- | ------------------------------------------------------------------------------ | --------- |
| **I1**  | Garde-fou serveur : une empreinte disputée crée une ligne et se journalise      | —         |
| **I2**  | Mobile : l'empreinte refuse le repli sur les attributs de modèle, identité faible déclarée | I1        |
| **I3**  | `hardware_key` (IDFV / App Set ID) — colonne, envoi, remplissage naturel        | I2        |
| **I4**  | Back-office : regrouper les lignes d'un même appareil, signaler l'identité faible | I3        |

I1 ferme la collision à lui seul, sans livraison mobile — c'est ce qui compte le plus et c'est le
moins risqué. I2 supprime la cause. I3 et I4 apportent la corrélation, et ne partent qu'une fois les
comptes éditeurs confirmés (ID-D5).

---

## Supervision à installer au passage

Toute ligne `devices` portant plus d'un utilisateur distinct est soit un partage d'appareil réel —
information qui intéresse la lutte contre la fraude — soit une collision, donc un défaut. Les deux
méritent d'être vus. Le compteur est à `0` aujourd'hui ; l'enjeu est qu'il le reste, et qu'on
l'apprenne autrement que par un utilisateur éjecté de son téléphone.

---

## Ce qu'on saura à la fin

Un appareil ne pourra plus être confondu avec son modèle, et une empreinte disputée ne pourra plus
déloger personne : elle produira une ligne de plus et une trace, jamais une fusion.

Le back-office cessera d'annoncer deux appareils là où il y en a un, et « comptes associés à cet
appareil » retrouvera son sens — il verra qu'un compte AigleSend et un compte AigleBusiness
partagent un téléphone, ce qu'aucune requête ne peut établir aujourd'hui.