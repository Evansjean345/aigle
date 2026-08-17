import type { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import type { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import type { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'

/**
 * Critères de listage des organisations pour l'espace admin.
 *
 * Contrat du port : la validation se fait à la frontière HTTP, ces champs sont déjà normalisés.
 * Chaque filtre absent signifie « ne restreint pas », jamais « valeur nulle ».
 */
export interface ListOrganisationsQuery {
  page: number
  perPage: number
  /** Recherche sur le nom, le code payable et l'identifiant de l'organisation. */
  search?: string
  accountType?: OrganisationAccountType
  level?: OrganisationLevel
  status?: OrganisationStatus
  /** Bornes de création, incluses. Format ISO. */
  startDate?: string
  endDate?: string
  /** Nom de tri exposé par l'API, clé de `organisationSorts`. Absent, l'ordre par défaut s'applique. */
  sortBy?: string
  order?: 'asc' | 'desc'
}

/**
 * Compteurs du bandeau de la liste des organisations.
 *
 * Agrégats bruts, sans mise en forme. Les totaux portent sur toutes les organisations, jamais sur
 * la page affichée.
 */
export interface OrganisationStatsCounts {
  total: number
  active: number
  inactive: number
  merchants: number
  enterprises: number
  /** Créées depuis minuit, dans le fuseau du serveur. */
  createdToday: number
}
