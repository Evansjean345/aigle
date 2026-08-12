/**
 * Stockage de fichiers en mémoire.
 *
 * Reproduit la surface publique de `FileStorageService` **sans la déclarer implémentée** : c'est une
 * classe concrète d'infrastructure, pas un port. TypeScript vérifie la conformité structurellement à
 * l'injection — une méthode ajoutée au service casse donc la compilation ici, en un seul endroit.
 *
 * Retient ce qui a été déposé et signé. Le chemin public n'existe plus : il n'y a donc plus rien à
 * vérifier de ce côté — la garantie est devenue structurelle.
 */
export default class InMemoryFileStorage {
  /** Clés rendues par le chemin privé. */
  privateUploads: string[] = []

  /** Clés effectivement signées, dans l'ordre. */
  signed: string[] = []

  async uploadPrivateFile(_file: any, destinationPath: string): Promise<string> {
    const key = `${destinationPath}/${this.privateUploads.length + 1}.jpg`
    this.privateUploads.push(key)

    return key
  }

  async signedUrl(key: string): Promise<string> {
    this.signed.push(key)

    return `https://signed.test/${key}`
  }

  async probeObject(): Promise<{ state: 'present'; visibility: string }> {
    return { state: 'present', visibility: 'private' }
  }
}
