/**
 * Lecture des URL héritées du dépôt public.
 *
 * Ces valeurs ont été produites par `FileStorageService.uploadFile`, qui déposait l'objet sous
 * `${dossier}/${uuid}.${extension}` et persistait l'URL publique correspondante. La clé de stockage
 * en est donc le chemin.
 *
 * Ce module disparaît avec la reprise : il n'existe que le temps de convertir ces URL en clés.
 */

/** Ce qu'on sait du dépôt, quand le nom du bucket figure dans le chemin plutôt que dans l'hôte. */
export interface StorageHints {
  bucket?: string
}

/**
 * Rend la clé de stockage désignée par une URL héritée.
 *
 * Une valeur déjà sous forme de clé est rendue inchangée : la reprise doit pouvoir être rejouée sur
 * des lignes déjà converties sans les abîmer.
 *
 * @param {string} [value] - URL stockée, ou clé déjà convertie.
 * @param {StorageHints} [hints] - Nom du bucket, s'il préfixe le chemin.
 * @returns {string | null} La clé, ou `null` si la valeur ne désigne rien d'exploitable.
 */
export function deriveStorageKey(value?: string, hints: StorageHints = {}): string | null {
  if (!value) return null

  const raw = value.trim()
  if (!raw) return null

  let path: string

  if (raw.includes('://')) {
    let parsed: URL

    try {
      parsed = new URL(raw)
    } catch {
      return null
    }

    path = decodeURIComponent(parsed.pathname)
  } else {
    if (raw.includes('/') === false) return null
    path = raw
  }

  let key = path.replace(/^\/+/, '')

  if (hints.bucket && key.startsWith(`${hints.bucket}/`)) {
    key = key.slice(hints.bucket.length + 1)
  }

  return key.length > 0 ? key : null
}

/**
 * Rend la forme d'une URL — hôte et premier segment — sans rien qui permette d'atteindre la pièce.
 *
 * Sert à inventorier les variantes rencontrées : deux URL du même dépôt partagent leur préfixe,
 * alors que leur suffixe identifie un document.
 *
 * @param {string} [value] - URL stockée.
 * @returns {string} Le préfixe, ou un marqueur pour les valeurs vides et non analysables.
 */
export function urlPrefix(value?: string): string {
  if (!value || !value.trim()) return '(vide)'

  const raw = value.trim()

  if (!raw.includes('://')) {
    const [first] = raw.replace(/^\/+/, '').split('/')

    return raw.includes('/') ? `(clé) ${first}` : '(non analysable)'
  }

  try {
    const parsed = new URL(raw)
    const [first] = decodeURIComponent(parsed.pathname).replace(/^\/+/, '').split('/')

    return first ? `${parsed.host}/${first}` : parsed.host
  } catch {
    return '(non analysable)'
  }
}
