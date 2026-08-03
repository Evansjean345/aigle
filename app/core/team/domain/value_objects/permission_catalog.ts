import InvalidPermissionDefinitionException from '#core/team/domain/exceptions/invalid_permission_definition_exception'
import DuplicatePermissionSlugException from '#core/team/domain/exceptions/duplicate_permission_slug_exception'

declare const permissionBrand: unique symbol

/**
 * Slug d'une permission du back-office.
 *
 * Type nominal : seule `definePermissions` peut en produire un. Une chaîne littérale n'est pas
 * assignable, ce qui empêche de vérifier une permission qui n'a jamais été déclarée.
 */
export type PermissionSlug = string & { readonly [permissionBrand]: 'permission' }

/** Une permission déclarée par une feature. */
export interface PermissionDefinition {
  readonly slug: PermissionSlug
  readonly name: string
  readonly description: string
  readonly sensitive: boolean
}

/** Ce qu'une feature écrit : identique à `PermissionDefinition', slug encore non marqué. */
export type PermissionDeclaration = Omit<PermissionDefinition, 'slug'> & { slug: string }

/** Catalogue d'une feature, tel que retourné par `definePermissions'. */
export type PermissionCatalog = Readonly<Record<string, PermissionDefinition>>

const SLUG_FORMAT = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/

/**
 * Valide une déclaration avant de la marquer.
 *
 * @param {PermissionDeclaration} declaration - La déclaration écrite par la feature.
 * @throws {InvalidPermissionDefinitionException} Slug malformé, libellé ou description vide.
 */
function assertValidDeclaration(declaration: PermissionDeclaration): void {
  if (!SLUG_FORMAT.test(declaration.slug)) {
    throw new InvalidPermissionDefinitionException(
      `« ${declaration.slug} » — attendu des segments en minuscules séparés par un point`
    )
  }

  if (declaration.name.trim() === '') {
    throw new InvalidPermissionDefinitionException(`« ${declaration.slug} » — libellé vide`)
  }

  if (declaration.description.trim() === '') {
    throw new InvalidPermissionDefinitionException(`« ${declaration.slug} » — description vide`)
  }
}

/**
 * Déclare le catalogue de permissions d'une feature.
 *
 * Unique porte par laquelle une chaîne devient un `PermissionSlug` : forger la marque ailleurs est
 * interdit par la configuration ESLint.
 *
 * @param {Record<K, PermissionDeclaration>} declarations - Les permissions de la feature, indexées par une clé de référence en code.
 * @returns {Readonly<Record<K, PermissionDefinition>>} Le catalogue figé, slugs marqués.
 * @throws {InvalidPermissionDefinitionException} Une déclaration est malformée.
 */
export function definePermissions<K extends string>(
  declarations: Record<K, PermissionDeclaration>
): Readonly<Record<K, PermissionDefinition>> {
  const catalog = {} as Record<K, PermissionDefinition>

  for (const key of Object.keys(declarations) as K[]) {
    const declaration = declarations[key]
    assertValidDeclaration(declaration)

    catalog[key] = Object.freeze({
      slug: declaration.slug as PermissionSlug,
      name: declaration.name,
      description: declaration.description,
      sensitive: declaration.sensitive,
    })
  }

  return Object.freeze(catalog)
}

/**
 * Rassemble les catalogues de toutes les features en un seul inventaire.
 *
 * @param {readonly PermissionCatalog[]} catalogs - Les catalogues déclarés par les features.
 * @returns {readonly PermissionDefinition[]} L'inventaire complet, sans doublon, dans l'ordre de déclaration.
 * @throws {DuplicatePermissionSlugException} Deux catalogues revendiquent le même slug.
 */
export function collectPermissions(
  catalogs: readonly PermissionCatalog[]
): readonly PermissionDefinition[] {
  const bySlug = new Map<string, PermissionDefinition>()

  for (const catalog of catalogs) {
    for (const definition of Object.values(catalog)) {
      if (bySlug.has(definition.slug)) {
        throw new DuplicatePermissionSlugException(definition.slug)
      }

      bySlug.set(definition.slug, definition)
    }
  }

  return Object.freeze([...bySlug.values()])
}

/**
 * Extrait les slugs d'un catalogue de feature.
 *
 * @param {PermissionCatalog} catalog - Le catalogue d'une feature.
 * @returns {PermissionSlug[]} Ses slugs, dans l'ordre de déclaration.
 */
export function permissionSlugs(catalog: PermissionCatalog): PermissionSlug[] {
  return Object.values(catalog).map((definition) => definition.slug)
}
