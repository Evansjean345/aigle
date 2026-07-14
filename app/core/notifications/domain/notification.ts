export class Notification {
  /**
   * @param recipientId Utilisateur destinataire.
   * @param title Titre de la notification.
   * @param message Corps du message.
   * @param data Payload optionnel (deep-link, métadonnées).
   * @param targetApp **Routage multi-app** (optionnel) : code de l'app cible
   *   (`aiglesend` / `aiglebusiness`). Si fourni, le push ne cible que les appareils de cette app ;
   *   absent → tous les appareils de confiance du user (comportement historique).
   */
  constructor(
    public readonly recipientId: string,
    public readonly title: string,
    public readonly message: string,
    public readonly data?: any,
    public readonly targetApp?: string
  ) {}
}
