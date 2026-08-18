/**
 * Vue minimale d'un appareil lié à un utilisateur, destinée aux produits.
 *
 * Ne porte pas l'empreinte ni l'uid de l'appareil : ces valeurs servent à s'authentifier par
 * en-têtes. `id` suffit à désigner l'appareil dans un retrait.
 */
export interface UserDeviceResult {
  id: string
  brand: string | null
  model: string | null
  platform: string | null
  appVersion: string | null
  status: string
  /** Un appareil principal ne peut pas être retiré. */
  isPrimary: boolean
  linkedAt: string | null
  lastSeenAt: string | null
  lastCountryCode: string | null
  /** L'appareil d'où vient la requête. Toujours `false` hors canal mobile. */
  current: boolean
}
