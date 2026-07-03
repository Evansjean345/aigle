// ── Result (output service → use case) ──────────────────────────────

/**
 * Bénéficiaire résolu + entrées de commande argent, produit par le `RecipientLocator` et consommé
 * par le use case wallet-to-wallet.
 *
 * Volontairement minimal : le compte destinataire (identifiant money-core) et son téléphone
 * (pour l'audit produit), le montant validé, et les codes de tarification. Aucun modèle `Wallet`
 * n'en sort — l'engine résout lui-même les deux wallets et la mécanique argent.
 */
export interface RecipientResolution {
  recipientUsersUid: string
  recipientPhone: string
  amount: number
  feeContext: {
    serviceTypeCode: string
    paymentMethodCode: string
    providerFromCode: string
  }
}
