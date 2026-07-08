/**
 * Vue publique minimale d'un pays (référentiel), exposée par `CountryDirectoryService`
 * aux couches externes (produits) qui ont besoin de données pays sans accéder au
 * repository ni au modèle `Country`.
 */
export interface CountryLookupResult {
  id: number
  name: string
  phoneCode: string
}
