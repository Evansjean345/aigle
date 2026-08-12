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

/** Dossiers sous lesquels `uploadFile` déposait. Rien d'autre ne vient de ce chemin. */
const LEGACY_PREFIXES = ['kyc_documents', 'kyc_selfies']

/** Vrai si l'hôte désigne le bucket attendu, en style *virtual-hosted*. */
function isBucketHost(host: string, bucket: string): boolean {
  return new RegExp(`^${escapeForRegExp(bucket)}\\.s3(\\.[a-z0-9-]+)?\\.amazonaws\\.com$`).test(
    host
  )
}

/** Vrai si l'hôte est un point d'entrée S3 en style *path*, le bucket étant alors dans le chemin. */
function isPathStyleHost(host: string): boolean {
  return /^s3(\.[a-z0-9-]+)?\.amazonaws\.com$/.test(host)
}

/** Neutralise ce qu'un nom de bucket pourrait contenir de significatif pour une expression. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Dit si une valeur héritée peut être reprise, c'est-à-dire si sa provenance est prouvée.
 *
 * Deux conditions, toutes deux nécessaires : l'objet vient du **bucket exact**, et il est déposé
 * sous l'un des dossiers de `uploadFile`. Sans cette garde, une URL étrangère se dériverait quand
 * même en clé — `https://placehold.co/900x620/x.png` donne `900x620/x.png` — et la reprise
 * inventerait des clés pointant vers rien tout en vidant les colonnes d'origine.
 *
 * Une valeur déjà sous forme de clé est acceptée si elle porte l'un des dossiers attendus : la
 * reprise doit rester rejouable sur des lignes déjà converties.
 *
 * @param {string} [value] - URL stockée, ou clé déjà convertie.
 * @param {string} bucket - Nom exact du bucket de dépôt.
 * @returns {boolean} `true` si la valeur peut être reprise sans risque.
 */
export function isReprisableLegacyValue(value: string | undefined, bucket: string): boolean {
  if (!value?.trim() || !bucket) return false

  const raw = value.trim()

  if (!raw.includes('://')) {
    return LEGACY_PREFIXES.some((prefix) => raw.replace(/^\/+/, '').startsWith(`${prefix}/`))
  }

  let parsed: URL

  try {
    parsed = new URL(raw)
  } catch {
    return false
  }

  const segments = decodeURIComponent(parsed.pathname)
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)

  if (isBucketHost(parsed.host, bucket)) {
    return LEGACY_PREFIXES.includes(segments[0] ?? '')
  }

  if (isPathStyleHost(parsed.host)) {
    return segments[0] === bucket && LEGACY_PREFIXES.includes(segments[1] ?? '')
  }

  return false
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
