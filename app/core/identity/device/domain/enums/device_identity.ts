/**
 * Solidité de l'identité déclarée par un appareil.
 *
 * L'empreinte n'a de valeur que si elle dérive d'un identifiant propre à l'appareil. Quand la
 * plateforme n'en fournit pas, le client le déclare au lieu de fabriquer une empreinte à partir
 * d'attributs de modèle, que tous les exemplaires partageraient.
 */
export enum DeviceIdentity {
  /** L'empreinte dérive d'un identifiant fourni par la plateforme, propre à l'appareil. */
  STRONG = 'strong',
  /** Aucun identifiant d'appareil disponible : l'empreinte ne vaut que pour cette installation. */
  WEAK = 'weak',
}
