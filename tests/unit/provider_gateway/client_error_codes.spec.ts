import { test } from '@japa/runner'
import { HUB2_CLIENT_ERRORS } from '#core/money/provider_gateway/domain/errors/hub2_client_errors'
import { WAVE_CLIENT_ERRORS } from '#core/money/provider_gateway/domain/errors/wave_client_errors'
import { ProviderErrorCode } from '#shared/enums/provider_error_enums'
import ProviderErrorService from '#shared/infrastructure/services/provider_error_service'

/**
 * Garde d'harmonisation (Lot 3b) : tout code produit par les tables client-error doit être un
 * `ProviderErrorCode` canonique, pour que `ProviderErrorService.resolve` classifie sans retomber
 * sur le fallback UNKNOWN — condition d'une classification/alerte/persistance correcte des erreurs
 * provider (init + settlement). Empêche la réintroduction d'un code hors taxonomie.
 */

const CANONICAL_CODES = new Set<string>(Object.values(ProviderErrorCode))

function assertHarmonized(map: Record<string, { code: string }>, label: string, assert: any): void {
  for (const [nativeCode, clientError] of Object.entries(map)) {
    assert.isTrue(
      CANONICAL_CODES.has(clientError.code),
      `${label}[${nativeCode}] → code '${clientError.code}' hors ProviderErrorCode`
    )

    // resolve doit renvoyer le code demandé (pas le fallback UNKNOWN_ERROR), sauf si c'est UNKNOWN.
    const resolved = ProviderErrorService.resolve(clientError.code)
    if (clientError.code !== ProviderErrorCode.UNKNOWN_ERROR) {
      assert.equal(
        resolved.code,
        clientError.code,
        `${label}[${nativeCode}] → '${clientError.code}' retombe sur le fallback`
      )
    }
  }
}

test.group('Harmonisation des codes client-error avec ProviderErrorCode', () => {
  test('HUB2_CLIENT_ERRORS : tous les codes sont canoniques et classifiables', ({ assert }) => {
    assertHarmonized(HUB2_CLIENT_ERRORS, 'HUB2_CLIENT_ERRORS', assert)
  })

  test('WAVE_CLIENT_ERRORS : tous les codes sont canoniques et classifiables', ({ assert }) => {
    assertHarmonized(WAVE_CLIENT_ERRORS, 'WAVE_CLIENT_ERRORS', assert)
  })
})
