export enum CollectionAccountType {
  /** Numéro mobile money d'entreprise (Wave, Orange Money…). */
  MOBILE_MONEY = 'mobile_money',
  /**
   * Compte bancaire. En Côte d'Ivoire c'est le plus souvent un **RIB** ou un numéro de compte, pas
   * un IBAN — aucun format n'est donc imposé sur `accountIdentifier` pour ce type.
   */
  BANK = 'bank',
}
