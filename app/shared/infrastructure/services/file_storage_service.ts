import drive from '@adonisjs/drive/services/main'

/** Durée de validité d'une URL signée. */
const SIGNED_URL_TTL = '15 mins'

/** Dépôt et consultation des fichiers téléversés. */
export default class FileStorageService {
  /**
   * Dépose un fichier en accès public.
   *
   * @param {any} filePath - Fichier multipart à déposer.
   * @param {string} destinationPath - Dossier de destination sur le disque.
   * @returns {Promise<string>} URL publique et permanente du fichier.
   */
  async uploadFile(filePath: any, destinationPath: string): Promise<string> {
    const key = `${destinationPath}/${crypto.randomUUID()}.${filePath.extname}`
    await filePath.moveToDisk(key, 's3')
    return filePath.meta.url
  }

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
}
