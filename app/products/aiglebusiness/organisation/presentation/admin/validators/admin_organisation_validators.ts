import vine from '@vinejs/vine'
import { organisationSortNames } from '#aiglebusiness/organisation/domain/types/organisation_sorts'
import { minSearchLength } from '#config/app'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'

/** Filtres et pagination de la liste admin. Sans filtre, toutes les organisations. */
export const listOrganisationsValidator = vine.create(
  vine.object({
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(100).optional(),
    search: vine.string().trim().minLength(minSearchLength).optional(),
    accountType: vine.enum(Object.values(OrganisationAccountType)).optional(),
    level: vine.enum(Object.values(OrganisationLevel)).optional(),
    status: vine.enum(Object.values(OrganisationStatus)).optional(),
    sortBy: vine.enum(organisationSortNames).optional(),
    order: vine.enum(['asc', 'desc'] as const).optional(),
    startDate: vine.string().optional(),
    endDate: vine.string().optional(),
  })
)

/** Terme d'autocomplétion. Obligatoire : une recherche vide rendrait toute la table. */
export const searchOrganisationsValidator = vine.create(
  vine.object({
    q: vine.string().trim().minLength(1),
  })
)

/**
 * Bascule de l'encaissement.
 *
 * Le motif est requis et non trivial : suspendre coupe les revenus du marchand, la décision doit
 * pouvoir s'expliquer des mois plus tard.
 */
export const setPayableStatusValidator = vine.create(
  vine.object({
    active: vine.boolean(),
    reason: vine.string().trim().minLength(10).maxLength(500),
  })
)

/**
 * Bascule du blocage d'une organisation.
 *
 * Le motif est requis et non trivial, comme pour l'encaissement.
 */
export const changeOrganisationStateValidator = vine.create(
  vine.object({
    blocked: vine.boolean(),
    reason: vine.string().trim().minLength(10).maxLength(500),
  })
)

/**
 * Gel ou dégel du portefeuille d'une organisation.
 *
 * Le motif est requis et non trivial : le gel arrête tout mouvement d'argent. Le sens de la
 * bascule vient de la route, pas du corps.
 */
export const freezeOrganisationWalletValidator = vine.create(
  vine.object({
    reason: vine.string().trim().minLength(10).maxLength(500),
  })
)

/** Filtres et pagination de la liste des membres d'une organisation. */
export const listOrganisationMembersValidator = vine.create(
  vine.object({
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(100).optional(),
    status: vine.enum(Object.values(MemberStatus)).optional(),
    search: vine.string().trim().minLength(1).optional(),
  })
)
