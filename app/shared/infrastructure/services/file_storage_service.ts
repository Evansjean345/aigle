import drive from '@adonisjs/drive/services/main'

/** Durée de validité d'une URL signée. */
const SIGNED_URL_TTL = '15 mins'

/**
 * État d'un objet tel que le stockage le rapporte.
 *
 * 'absent` signifie que le stockage a répondu que l'objet n'existe pas ; `unreachable` qu'il n'a pas
 * répondu du tout. Les deux ne se confondent jamais.
 */
export type ObjectProbe =
  | { state: 'present'; visibility: string }
  | { state: 'absent' }
  | { state: 'unreachable'; reason: string }

/** Ce que le stockage renvoie quand l'objet n'existe pas, selon les formes rencontrées. */
function isNotFound(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown })?.cause]

  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false

    const shaped = candidate as {
      name?: string
      Code?: string
      $metadata?: { httpStatusCode?: number }
    }

    return (
      shaped.$metadata?.httpStatusCode === 404 ||
      ['NotFound', 'NoSuchKey'].includes(shaped.name ?? '') ||
      ['NotFound', 'NoSuchKey'].includes(shaped.Code ?? '')
    )
  })
}

/** Message d'erreur exploitable, sans exposer la clé sondée. */
function reasonOf(error: unknown): string {
  const shaped = error as { message?: string; name?: string }

  return shaped?.message ?? shaped?.name ?? 'erreur inconnue'
}

/** Dépôt et consultation des fichiers téléversés. */
export default class FileStorageService {
  /**
   * Dépose un fichier en accès privé.
   *
   * Renvoie la clé de l'objet et non une URL : un objet privé se consulte par une URL signée
   * générée à la demande, qui expire et n'a donc pas vocation à être stockée.
   *
   * @param {any} file - Fichier multipart à déposer.
   * @param {string} destinationPath - Dossier de destination sur le disque.
   * @returns {Promise<string>} Clé de l'objet, à persister.
   */
  async uploadPrivateFile(file: any, destinationPath: string): Promise<string> {
    const key = `${destinationPath}/${crypto.randomUUID()}.${file.extname}`
    await file.moveToDisk(key, 's3_private')
    return key
  }

  /**
   * Génère une URL temporaire de consultation d'un objet privé.
   *
   * À appeler au moment de servir la réponse : l'URL expire.
   *
   * @param {string} key - Clé de l'objet.
   * @param {string} [expiresIn] - Durée de validité, `15 mins` par défaut.
   * @returns {Promise<string>} URL signée.
   */
  async signedUrl(key: string, expiresIn: string = SIGNED_URL_TTL): Promise<string> {
    return drive.use('s3_private').getSignedUrl(key, { expiresIn })
  }

  /**
   * Constate l'état d'un objet : présent et sous quelle visibilité, absent, ou inatteignable.
   *
   * Rend un état plutôt que de lever, parce que l'appelant doit pouvoir distinguer « le stockage
   * répond que l'objet n'existe pas » de « le stockage ne répond pas ». Les confondre ferait passer
   * une panne de transport pour un inventaire de fichiers manquants.
   *
   * @param {string} key - Clé de l'objet.
   * @returns {Promise<ObjectProbe>} L'état constaté.
   */
  async probeObject(key: string): Promise<ObjectProbe> {
    const disk = drive.use('s3_private')

    try {
      await disk.getMetaData(key)
    } catch (error) {
      return isNotFound(error)
        ? { state: 'absent' }
        : { state: 'unreachable', reason: reasonOf(error) }
    }

    try {
      const visibility = await disk.getVisibility(key)

      return { state: 'present', visibility }
    } catch (error) {
      return { state: 'unreachable', reason: reasonOf(error) }
    }
  }
}
